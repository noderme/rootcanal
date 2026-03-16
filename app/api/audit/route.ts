import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ──────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ── HELPER: Parse "Street, City, State ZIP, USA" → "City, ST" ──
function parseCityFromAddress(address: string): string {
  if (!address) return "";
  const parts = address.split(",");
  if (parts.length >= 3) {
    const cityPart = parts[parts.length - 3].trim();
    const statePart = parts[parts.length - 2].trim();
    const stateCode = statePart.replace(/\s\d{5}.*/, "").trim();
    if (/^[A-Z]{2}$/.test(stateCode)) return `${cityPart}, ${stateCode}`;
  }
  return "";
}

// ── IN-MEMORY CACHE ───────────────────────────────────────
const cache = new Map<string, { data: AuditResult; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface AuditResult {
  url: string;
  city: string;
  clinicName?: string;
  overallScore: number;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  issues: { title: string; desc: string; priority: string; status: string }[];
  competitors: {
    name: string;
    rating: number;
    reviews: number;
    address: string;
    score: number;
  }[];
  placeId: string;
  scannedAt: string;
  userRank?: number;
  userReviewCount?: number;
  yelpRating?: number;
  yelpReviewCount?: number;
  yelpUrl?: string;
  yelpRank?: number;
  yelpCompetitors?: { name: string; rating: number; reviews: number; rank: number; url?: string }[];
  healthgradesFound?: boolean;
  healthgradesRating?: number;
  healthgradesReviews?: number;
  healthgradesClaimed?: boolean;
  healthgradesUrl?: string;
  cached?: boolean;
}

function getCached(key: string): AuditResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return { ...entry.data, cached: true };
}

function setCache(key: string, data: AuditResult) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ── SLEEP HELPER ──────────────────────────────────────────
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── PAGESPEED WITH RETRY ──────────────────────────────────
async function fetchPageSpeed(
  url: string,
  apiKey: string,
  retries = 3,
): Promise<{
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  audits: Record<string, { score: number | null }>;
}> {
  const psUrl = [
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
    `?url=${encodeURIComponent(url)}`,
    `&key=${apiKey}`,
    "&strategy=mobile",
    "&category=performance",
    "&category=seo",
    "&category=accessibility",
  ].join("");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(psUrl);
      const data = await res.json();

      console.log(`PageSpeed attempt ${attempt} — status: ${res.status}`);

      if (res.status === 429) {
        if (attempt < retries) {
          console.log(`Rate limited. Waiting ${attempt * 3}s...`);
          await sleep(attempt * 3000);
          continue;
        }
        return {
          performanceScore: 0,
          seoScore: 0,
          accessibilityScore: 0,
          audits: {},
        };
      }

      const cats = data?.lighthouseResult?.categories ?? {};
      const audits = data?.lighthouseResult?.audits ?? {};

      const performanceScore = Math.round(
        (cats?.performance?.score ?? 0) * 100,
      );
      const seoScore = Math.round((cats?.seo?.score ?? 0) * 100);
      const accessibilityScore = Math.round(
        (cats?.accessibility?.score ?? 0) * 100,
      );

      console.log("Scores:", {
        performanceScore,
        seoScore,
        accessibilityScore,
      });
      return { performanceScore, seoScore, accessibilityScore, audits };
    } catch (err) {
      console.error(`PageSpeed attempt ${attempt} failed:`, err);
      if (attempt < retries) await sleep(2000);
    }
  }

  return {
    performanceScore: 0,
    seoScore: 0,
    accessibilityScore: 0,
    audits: {},
  };
}

// ── MAIN HANDLER ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  // Never trust city from query param — always re-detect from GBP for accuracy
  let city = "";

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY || "";

  // ── Dental clinic check — reject non-dental websites ──
  try {
    const dentalKeywords = [
      "dental",
      "dentist",
      "orthodont",
      "endodont",
      "periodon",
      "implant",
      "teeth",
      "tooth",
      "oral",
      "smile",
      "clinic",
      "dds",
      "dmd",
      "dr.",
    ];
    const normalizedDomain = url
      .replace(/https?:\/\//, "")
      .replace(/^www\./, "")
      .toLowerCase();

    // Check 1: domain name contains dental keywords
    const domainIsDental = dentalKeywords.some((kw) =>
      normalizedDomain.includes(kw),
    );

    // Check 2: fetch homepage and check for dental keywords in page content
    let pageIsDental = false;
    if (!domainIsDental) {
      try {
        const pageRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const pageText = (await pageRes.text()).toLowerCase().slice(0, 5000);
        pageIsDental = dentalKeywords.some((kw) => pageText.includes(kw));
        console.log("🦷 Page dental check:", pageIsDental, "for", url);
      } catch {
        /* ignore fetch errors */
      }
    }

    if (!domainIsDental && !pageIsDental) {
      // Final fallback — check Google Places before rejecting
      // Some dental clinics have non-obvious domain names
      try {
        const checkDomain = url
          .replace(/https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0];
        const placesCheckRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(checkDomain)}&type=dentist&key=${apiKey}`,
        );
        const placesCheckData = await placesCheckRes.json();
        const foundAsDentist = (placesCheckData.results?.length || 0) > 0;
        console.log(
          "🦷 Places dental check:",
          foundAsDentist,
          "for",
          checkDomain,
        );
        if (!foundAsDentist) {
          console.log("❌ Not a dental website:", url);
          return NextResponse.json(
            {
              error: "not_dental",
              message:
                "This doesn't appear to be a dental clinic website. Please enter your clinic's URL (e.g. bestsmilesdental.com).",
            },
            { status: 400 },
          );
        }
      } catch {
        console.log("⚠️ Places dental check failed — allowing through");
      }
    }
  } catch (e) {
    console.error("Dental check error:", e);
  }

  // ── Auto-detect city from website content + Google Places ──
  let cityDetectionPlaceId: string | null = null;
  let cityDetectionName: string | null = null;
  const inputDomain = url
    .replace(/https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .toLowerCase();

  if (!city) {
    try {
      // ── STRATEGY 1: Scrape the clinic website for address/city ──
      // Most reliable — the website itself knows where it is
      let cityFromPage = "";
      try {
        const pageRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(5000),
        });
        const pageHtml = await pageRes.text();

        // Extract from schema.org LocalBusiness / Dentist markup
        const schemaMatch =
          pageHtml.match(/"addressLocality"\s*:\s*"([^"]+)"/i) ||
          pageHtml.match(/"addressRegion"\s*:\s*"([^"]+)"/i);
        const localityMatch = pageHtml.match(
          /"addressLocality"\s*:\s*"([^"]+)"/i,
        );
        const regionMatch = pageHtml.match(/"addressRegion"\s*:\s*"([^"]+)"/i);

        if (localityMatch && regionMatch) {
          cityFromPage = `${localityMatch[1]}, ${regionMatch[1]}`;
          console.log("🏙️ City from schema.org:", cityFromPage);
        } else {
          // Fallback: look for US state pattern near address keywords
          const statePattern =
            /\b([A-Z][a-z]+(?: [A-Z][a-z]+)?),\s*([A-Z]{2})\s+\d{5}/g;
          const matches = [...pageHtml.matchAll(statePattern)];
          if (matches.length > 0) {
            cityFromPage = `${matches[0][1]}, ${matches[0][2]}`;
            console.log("🏙️ City from address pattern:", cityFromPage);
          }
        }
      } catch (e) {
        console.log("🏙️ Page fetch failed, trying Places API");
      }

      if (cityFromPage && !cityFromPage.toLowerCase().includes("india")) {
        city = cityFromPage;
      }

      // ── STRATEGY 2: Google Places textsearch with website URL ──
      // Use nearbysearch or textsearch querying the domain directly
      if (!city) {
        const byWebsite = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(inputDomain)}&type=dentist&key=${apiKey}`,
        );
        const websiteData = await byWebsite.json();
        // Take ALL results and find one whose website matches our domain
        for (const result of (websiteData.results || []).slice(0, 5)) {
          if (!result.place_id) continue;
          const detRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${result.place_id}&fields=website,formatted_address&key=${apiKey}`,
          );
          const detData = await detRes.json();
          const gbpDomain = (detData.result?.website || "")
            .replace(/https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0]
            .toLowerCase();
          console.log(`🔗 S2 check: ${inputDomain} vs ${gbpDomain}`);
          if (
            gbpDomain &&
            (gbpDomain.includes(inputDomain) || inputDomain.includes(gbpDomain))
          ) {
            const parsed = parseCityFromAddress(
              detData.result?.formatted_address || "",
            );
            if (parsed && !parsed.toLowerCase().includes("india")) {
              city = parsed;
              cityDetectionPlaceId = result.place_id;
              cityDetectionName = result.name;
              console.log(
                "✅ City from Places domain match:",
                city,
                result.name,
              );
              break;
            }
          }
        }
      }

      // ── STRATEGY 3: Places textsearch with clinic name from domain ──
      if (!city) {
        const clinicQuery = inputDomain
          .replace(/\.(com|net|org|io|us)$/, "")
          .replace(/[-_.]/g, " ");
        const byName = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(clinicQuery + " dental")}&region=us&type=dentist&key=${apiKey}`,
        );
        const nameData = await byName.json();
        const topResult = nameData.results?.[0];
        if (
          topResult &&
          !topResult.formatted_address?.toLowerCase().includes("india")
        ) {
          const parsed = parseCityFromAddress(
            topResult.formatted_address || "",
          );
          if (parsed) {
            city = parsed;
            cityDetectionPlaceId = topResult.place_id;
            cityDetectionName = topResult.name;
            console.log("🏙️ City from name search:", city, topResult.name);
          }
        }
      }

      if (!city) city = "New York, NY";
      console.log("🏙️ Final city:", city);
    } catch (e) {
      console.error("City detection error:", e);
      city = "New York, NY";
    }
  }

  const cacheKey = url.toLowerCase(); // city excluded — city is always re-detected

  // ── Check Supabase cache first (persistent across serverless invocations) ──
  try {
    const since = new Date(Date.now() - CACHE_TTL).toISOString();
    const { data: cachedRow } = await supabase
      .from("scans")
      .select("result, scanned_at")
      .eq("url", url)
      .not("result", "is", null)
      .gte("scanned_at", since)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .single();

    if (cachedRow?.result) {
      console.log("Supabase cache hit:", cacheKey);
      return NextResponse.json({ ...cachedRow.result, cached: true });
    }
  } catch {
    // No cache hit — proceed with full audit
  }

  // ── Check in-memory cache (fallback for same instance) ──
  const cached = getCached(cacheKey);
  if (cached && cached.placeId) {
    console.log("Memory cache hit:", cacheKey);
    return NextResponse.json(cached);
  }

  try {
    // ── 1. PAGESPEED ──────────────────────────────────
    const { performanceScore, seoScore, accessibilityScore, audits } =
      await fetchPageSpeed(url, apiKey);

    // If all 3 scores are 0, PageSpeed API failed — default to 50 to avoid showing 0/100
    const pageSpeedFailed =
      performanceScore === 0 && seoScore === 0 && accessibilityScore === 0;
    const overallScore = pageSpeedFailed
      ? 50
      : Math.round((performanceScore + seoScore + accessibilityScore) / 3);

    // ── 2. ISSUES ─────────────────────────────────────
    const issues: {
      title: string;
      desc: string;
      priority: string;
      status: string;
    }[] = [];

    // Mobile
    if (audits?.viewport?.score === 0) {
      issues.push({
        title: "Doesn't work on phones",
        desc: "70% of patients search on their phone. Your website doesn't work well on phones.",
        priority: "HIGH",
        status: "fail",
      });
    } else {
      issues.push({
        title: "Shows on mobile ✅",
        desc: "Your website works well on phones.",
        priority: "GOOD",
        status: "pass",
      });
    }

    // Speed
    if (performanceScore === 0) {
      issues.push({
        title: "Speed check unavailable",
        desc: "We couldn't measure your page speed. Try again in a moment.",
        priority: "MED",
        status: "warn",
      });
    } else if (performanceScore < 50) {
      issues.push({
        title: "Website is too slow",
        desc: "Slow websites lose patients before they even see you. Google ranks fast websites higher.",
        priority: "HIGH",
        status: "fail",
      });
    } else if (performanceScore < 80) {
      issues.push({
        title: "Website could be faster",
        desc: "Your website could load faster. This affects both patients and Google ranking.",
        priority: "MED",
        status: "warn",
      });
    } else {
      issues.push({
        title: "Website loads fast ✅",
        desc: "Your page loads quickly. Google rewards fast websites.",
        priority: "GOOD",
        status: "pass",
      });
    }

    // SEO
    if (seoScore === 0) {
      issues.push({
        title: "Google visibility check unavailable",
        desc: "We couldn't measure your SEO score. Try again in a moment.",
        priority: "MED",
        status: "warn",
      });
    } else if (seoScore < 50) {
      issues.push({
        title: "Google can't find your clinic",
        desc: "Your clinic has issues that stop Google from showing it to patients.",
        priority: "HIGH",
        status: "fail",
      });
    } else if (seoScore < 80) {
      issues.push({
        title: "Google visibility needs work",
        desc: "Some issues are stopping patients from finding you on Google.",
        priority: "MED",
        status: "warn",
      });
    } else {
      issues.push({
        title: "Good Google presence ✅",
        desc: "Your clinic is easy for Google to find.",
        priority: "GOOD",
        status: "pass",
      });
    }

    // Meta description
    if (audits?.["meta-description"]?.score === 0) {
      issues.push({
        title: "Missing Google search preview",
        desc: "Your clinic is missing a description in Google search results. Patients can't see what you offer.",
        priority: "HIGH",
        status: "fail",
      });
    } else if (audits?.["meta-description"]?.score === 1) {
      issues.push({
        title: "Google search preview present ✅",
        desc: "Patients can see your clinic description in Google search results.",
        priority: "GOOD",
        status: "pass",
      });
    }

    // Page title
    if (audits?.["document-title"]?.score === 0) {
      issues.push({
        title: "Missing clinic name on Google",
        desc: "Google can't find your clinic name. This hurts your ranking.",
        priority: "HIGH",
        status: "fail",
      });
    }

    // Image alt text
    if (audits?.["image-alt"]?.score === 0) {
      issues.push({
        title: "Images not labeled",
        desc: "Your website images have no labels. This hurts your Google ranking.",
        priority: "MED",
        status: "warn",
      });
    }

    // SSL
    if (!url.startsWith("https://")) {
      issues.push({
        title: "Website not secure",
        desc: "Your website is not secure. Google ranks secure websites higher.",
        priority: "HIGH",
        status: "fail",
      });
    } else {
      issues.push({
        title: "Website is secure ✅",
        desc: "Your website is secure. Google rewards this with a small ranking boost.",
        priority: "GOOD",
        status: "pass",
      });
    }

    // ── 3. GOOGLE BUSINESS PROFILE CHECK ────────────
    let clinicPlaceId = "";
    let clinicName: string | undefined;
    let clinicReviewCount: number | undefined;
    let clinicLat: number | undefined;
    let clinicLng: number | undefined;
    try {
      const clinicSearchName = url
        .replace(/https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .replace(/\.my\.canva\.site$/, "")
        .replace(/\.(com|net|org|io|us)$/, "")
        .replace(/[-_.]/g, " ")
        .trim();

      // Helper: check if address is in India
      const isIndia = (p: { formatted_address?: string }) =>
        p?.formatted_address?.toLowerCase().includes("india") ||
        p?.formatted_address?.toLowerCase().includes("hyderabad");

      // Helper: verify GBP website matches scanned URL
      const normalizedInputUrl = url
        .replace(/https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .toLowerCase();
      const websiteMatches = async (placeId: string): Promise<boolean> => {
        try {
          const detailRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${apiKey}`,
          );
          const detailData = await detailRes.json();
          const gbpWebsite = (detailData.result?.website || "")
            .replace(/https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0]
            .toLowerCase();
          if (!gbpWebsite) return true; // no website listed — assume ok
          const match =
            gbpWebsite.includes(normalizedInputUrl) ||
            normalizedInputUrl.includes(gbpWebsite);
          console.log(
            `🔗 Website match check: ${normalizedInputUrl} vs ${gbpWebsite} → ${match}`,
          );
          return match;
        } catch {
          return true;
        }
      };

      let place: {
        place_id?: string;
        name?: string;
        rating?: number;
        user_ratings_total?: number;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      } | null = null;

      // Strategy 0: reuse placeId already found during city detection (most reliable)
      if (cityDetectionPlaceId && !clinicPlaceId) {
        const matched = await websiteMatches(cityDetectionPlaceId);
        if (matched) {
          // Fetch full details for this placeId
          const s0Res = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${cityDetectionPlaceId}&fields=place_id,name,rating,user_ratings_total,formatted_address,geometry&key=${apiKey}`,
          );
          const s0Data = await s0Res.json();
          const s0Place = s0Data.result;
          if (s0Place && !isIndia(s0Place)) {
            clinicPlaceId = cityDetectionPlaceId;
            place = s0Place;
            const gbpCity = parseCityFromAddress(
              s0Place.formatted_address ?? "",
            );
            if (gbpCity) {
              city = gbpCity;
            }
            console.log(
              "✅ GBP found (strategy 0 — reused):",
              s0Place.name,
              s0Place.formatted_address,
              "city:",
              city,
            );
          }
        } else {
          console.log(
            "⚠️ Strategy 0 placeId website mismatch — continuing to strategy 1",
          );
        }
      }

      // Strategy 1: search by "clinic name dentist city"
      if (!clinicPlaceId) {
        const gbpQuery = `${clinicSearchName} dentist ${city}`;
        const gbpUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(gbpQuery)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total,business_status,formatted_address&key=${apiKey}`;
        const gbpRes = await fetch(gbpUrl);
        const gbpData = await gbpRes.json();
        place = gbpData.candidates?.[0];

        if (place?.place_id && !isIndia(place)) {
          const matched = await websiteMatches(place.place_id);
          if (matched) {
            clinicPlaceId = place.place_id;
            console.log(
              "✅ GBP found (strategy 1):",
              place.name,
              place.formatted_address,
            );
            // ✅ Override city with actual GBP address — most accurate source of truth
            const gbpCity = parseCityFromAddress(place.formatted_address ?? "");
            if (gbpCity) {
              city = gbpCity;
              console.log("🏙️ City overridden from GBP (s1):", city);
            }
          } else {
            console.log("⚠️ GBP website mismatch — skipping strategy 1 result");
            place = null;
          }
        }
      } // end strategy 1

      // Strategy 2: fallback — search by website URL via textsearch
      if (!clinicPlaceId) {
        const normalizedUrl = url
          .replace(/https?:\/\//, "")
          .replace(/^www\./, "");
        const gbpUrl2 = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(normalizedUrl + " dentist")}&type=dentist&key=${apiKey}`;
        const gbpRes2 = await fetch(gbpUrl2);
        const gbpData2 = await gbpRes2.json();
        place = gbpData2.results?.[0];
        if (place?.place_id && !isIndia(place)) {
          const matched = await websiteMatches(place.place_id);
          if (matched) {
            clinicPlaceId = place.place_id;
            console.log(
              "✅ GBP found (strategy 2):",
              place.name,
              place.formatted_address,
            );
            // ✅ Override city with actual GBP address
            const gbpCity = parseCityFromAddress(place.formatted_address ?? "");
            if (gbpCity) {
              city = gbpCity;
              console.log("🏙️ City overridden from GBP (s2):", city);
            }
          } else {
            console.log("⚠️ GBP website mismatch — skipping strategy 2 result");
            place = null;
          }
        }
      }

      console.log("🔑 Final placeId:", clinicPlaceId || "NOT FOUND");

      if (!place?.place_id) {
        issues.push({
          title: "Google Business Profile not found",
          desc: "Your clinic doesn't appear on Google Maps. This is the #1 way patients find dentists near them.",
          priority: "HIGH",
          status: "fail",
        });
      } else if (!place.rating || (place.user_ratings_total ?? 0) < 5) {
        issues.push({
          title: "Google Business Profile needs attention",
          desc: "Your clinic is on Google Maps but has very few reviews. More reviews = higher ranking = more patients.",
          priority: "MED",
          status: "warn",
        });
      } else {
        issues.push({
          title: "Google Business Profile active ✅",
          desc: `Your clinic appears on Google Maps with ${place.rating}⭐ rating and ${place.user_ratings_total} reviews.`,
          priority: "GOOD",
          status: "pass",
        });
      }
      if (place?.name) clinicName = place.name;
      if (place?.user_ratings_total != null) clinicReviewCount = place.user_ratings_total;
      if (place?.geometry?.location?.lat != null) clinicLat = place.geometry.location.lat;
      if (place?.geometry?.location?.lng != null) clinicLng = place.geometry.location.lng;
    } catch (gbpError) {
      console.error("GBP check error:", gbpError);
    }

    // ── 4. HEALTHGRADES & ZOCDOC CHECK ──────────────
    try {
      // Extract clinic name from domain for searching
      const domainName = url
        .replace(/https?:\/\//, "")
        .replace(/www\./, "")
        .split(".")[0];
      const clinicSearchName = domainName.replace(/-/g, " ");

      // Check Healthgrades
      const hgRes = await fetch(
        `https://www.healthgrades.com/search?what=${encodeURIComponent(clinicSearchName + " dentist")}&where=${encodeURIComponent(city)}`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
        },
      );
      const hgText = await hgRes.text();
      const onHealthgrades =
        hgText.includes(clinicSearchName.split(" ")[0].toLowerCase()) ||
        hgText.includes("dentist");

      if (onHealthgrades) {
        issues.push({
          title: "Listed on Healthgrades ✅",
          desc: "Your clinic appears on Healthgrades — one of the top sites patients use to find and review dentists.",
          priority: "GOOD",
          status: "pass",
        });
      } else {
        issues.push({
          title: "Not listed on Healthgrades",
          desc: "Healthgrades is one of the most trusted sites for finding dentists. Patients check it before booking.",
          priority: "MED",
          status: "warn",
        });
      }

      // Check Zocdoc
      const zdRes = await fetch(
        `https://www.zocdoc.com/search?dr_specialty=12&address=${encodeURIComponent(city)}&q=${encodeURIComponent(clinicSearchName)}`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
        },
      );
      const zdText = await zdRes.text();
      const onZocdoc = zdText.includes(
        clinicSearchName.split(" ")[0].toLowerCase(),
      );

      if (onZocdoc) {
        issues.push({
          title: "Listed on Zocdoc ✅",
          desc: "Your clinic is on Zocdoc — patients can find and book appointments with you directly.",
          priority: "GOOD",
          status: "pass",
        });
      } else {
        issues.push({
          title: "Not listed on Zocdoc",
          desc: "Zocdoc lets patients book dental appointments online. Missing from Zocdoc means missing bookings.",
          priority: "MED",
          status: "warn",
        });
      }
    } catch (listingError) {
      console.error("Listings check error:", listingError);
    }

    // ── 5. COMPETITORS via Google Places ──────────────
    let competitors: {
      name: string;
      rating: number;
      reviews: number;
      address: string;
      score: number;
    }[] = [];
    let userRank: number | undefined;

    try {
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=dental+clinic+in+${encodeURIComponent(city)}&key=${apiKey}`;
      const placesRes = await fetch(placesUrl);
      const placesData = await placesRes.json();

      console.log("Places status:", placesData.status);

      // Filter out non-clinic results (universities, hospitals, schools)
      const NON_CLINIC_KEYWORDS = [
        "university",
        "college",
        "school",
        "hospital",
        "nyu",
        "columbia",
        "institute",
        "academy",
        "clinic at",
      ];
      const filteredPlaces = (placesData.results || []).filter(
        (p: { name: string }) =>
          !NON_CLINIC_KEYWORDS.some((kw) => p.name.toLowerCase().includes(kw)),
      );

      // Find clinic's actual rank by matching place_id in the results array (fallback)
      if (clinicPlaceId) {
        const rankIndex = filteredPlaces.findIndex(
          (p: { place_id?: string }) => p.place_id === clinicPlaceId,
        );
        if (rankIndex !== -1) {
          userRank = rankIndex + 1;
          console.log(`📍 Clinic Places rank (fallback): #${userRank}`);
        }
      }

      if (filteredPlaces.length > 0) {
        competitors = filteredPlaces.slice(0, 7).map(
          (
            place: {
              name: string;
              rating?: number;
              user_ratings_total?: number;
              formatted_address?: string;
            },
            index: number,
          ) => ({
            name: place.name,
            rating: place.rating ?? 0,
            reviews: place.user_ratings_total ?? 0,
            address: place.formatted_address ?? "",
            score: Math.min(
              95,
              Math.max(
                30,
                Math.round(90 - index * 7 + ((place.rating ?? 0) - 4.0) * 5),
              ),
            ),
          }),
        );
        competitors.sort((a, b) => b.score - a.score);
      }
    } catch (placesError) {
      console.error("Places error:", placesError);
    }

    // ── 3b. SERPAPI ACCURATE RANK DETECTION ───────────
    const serpapiKey = process.env.SERPAPI_KEY;
    if (serpapiKey && clinicName && (clinicLat != null || city)) {
      try {
        const searchQuery = encodeURIComponent(`dentist near me`);
        const ll = clinicLat != null && clinicLng != null
          ? `@${clinicLat},${clinicLng},14z`
          : "";
        const locationParam = ll
          ? `&ll=${encodeURIComponent(ll)}`
          : `&location=${encodeURIComponent(city + ", USA")}`;
        const serpapiUrl = `https://serpapi.com/search.json?engine=google_maps&q=${searchQuery}&type=search${locationParam}&api_key=${serpapiKey}`;
        const serpapiRes = await fetch(serpapiUrl, { signal: AbortSignal.timeout(10000) });
        const serpapiData = await serpapiRes.json();
        const localResults: { place_id?: string; title?: string; position?: number }[] = serpapiData?.local_results || [];
        if (localResults.length > 0 && clinicPlaceId) {
          const serpRankIndex = localResults.findIndex(r => r.place_id === clinicPlaceId);
          if (serpRankIndex !== -1) {
            userRank = serpRankIndex + 1;
            console.log(`📍 SerpAPI accurate rank: #${userRank}`);
          } else {
            // fallback: match by clinic name
            const nameMatch = localResults.findIndex(r =>
              r.title?.toLowerCase().includes((clinicName ?? "").toLowerCase().split(" ")[0])
            );
            if (nameMatch !== -1) {
              userRank = nameMatch + 1;
              console.log(`📍 SerpAPI name-match rank: #${userRank}`);
            }
          }
        }
      } catch (serpapiError) {
        console.error("SerpAPI error:", serpapiError);
      }
    }

    // ── 4. YELP LOOKUP VIA SERPAPI ────────────────────
    let yelpRating: number | undefined;
    let yelpReviewCount: number | undefined;
    let yelpUrl: string | undefined;
    let yelpRank: number | undefined;
    let yelpCompetitors: { name: string; rating: number; reviews: number; rank: number; url?: string }[] | undefined;
    if (serpapiKey && clinicName) {
      try {
        const yelpQuery = encodeURIComponent("dentist");
        const yelpLocation = encodeURIComponent(city || "New York");
        const yelpRes = await fetch(
          `https://serpapi.com/search.json?engine=yelp&find_desc=${yelpQuery}&find_loc=${yelpLocation}&api_key=${serpapiKey}`,
          { signal: AbortSignal.timeout(10000) }
        );
        const yelpData = await yelpRes.json();
        console.log("Yelp raw result[0]:", JSON.stringify(yelpData?.organic_results?.[0]).slice(0, 300));
        type YelpResult = { title?: string; name?: string; rating?: number | { value?: number }; reviews?: number; review_count?: number; url?: string; link?: string };
        const results: YelpResult[] = yelpData?.organic_results || [];
        // Normalize helpers — SerpAPI Yelp uses `title`, rating may be nested
        const bizName = (r: YelpResult) => r.title || r.name || "";
        const bizRating = (r: YelpResult): number => {
          if (typeof r.rating === "number") return r.rating;
          if (typeof r.rating === "object" && r.rating?.value != null) return r.rating.value;
          return 0;
        };
        const bizReviews = (r: YelpResult) => r.reviews ?? r.review_count ?? 0;
        const bizUrl = (r: YelpResult) => r.url || r.link;

        // Find clinic by name match
        const clinicNameLower = clinicName.toLowerCase();
        const matchIndex = results.findIndex(r =>
          bizName(r).toLowerCase().includes(clinicNameLower.split(" ")[0]) ||
          clinicNameLower.includes(bizName(r).toLowerCase().split(" ")[0])
        );
        if (matchIndex !== -1) {
          const biz = results[matchIndex];
          yelpRank = matchIndex + 1;
          yelpRating = bizRating(biz);
          yelpReviewCount = bizReviews(biz);
          yelpUrl = bizUrl(biz);
        } else if (results[0]) {
          yelpRating = bizRating(results[0]);
          yelpReviewCount = bizReviews(results[0]);
          yelpUrl = bizUrl(results[0]);
        }
        // Save top 7 Yelp results as competitor leaderboard
        yelpCompetitors = results.slice(0, 7).map((r, i) => ({
          name: bizName(r) || "—",
          rating: bizRating(r),
          reviews: bizReviews(r),
          rank: i + 1,
          url: bizUrl(r),
        }));
      } catch (yelpError) {
        console.error("Yelp error:", yelpError);
      }
    }

    // ── 4b. HEALTHGRADES VIA APIFY ────────────────────
    let healthgradesFound = false;
    let healthgradesRating: number | undefined;
    let healthgradesReviews: number | undefined;
    let healthgradesClaimed: boolean | undefined;
    let healthgradesUrl: string | undefined;
    const apifyKey = process.env.APIFY_API_KEY;
    if (apifyKey && clinicName) {
      try {
        const runRes = await fetch(
          `https://api.apify.com/v2/acts/jaybird~healthgrades-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=30`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ specialty: clinicName, location: city || "USA", maxResults: 1, maxPages: 1 }),
            signal: AbortSignal.timeout(35000),
          }
        );
        const hgData = await runRes.json();
        const hg = Array.isArray(hgData) ? hgData[0] : null;
        if (hg) {
          healthgradesFound = true;
          healthgradesRating = hg.rating ?? hg.overallRating;
          healthgradesReviews = hg.reviewCount ?? hg.numberOfRatings;
          healthgradesClaimed = hg.isClaimed ?? hg.claimed;
          healthgradesUrl = hg.url ?? hg.profileUrl;
        }
      } catch {
        // silently fail — not critical
      }
    }

    // ── 5. Build result ───────────────────────────────
    const result: AuditResult = {
      url,
      city,
      clinicName,
      overallScore,
      performanceScore,
      seoScore,
      accessibilityScore,
      issues,
      competitors,
      placeId: clinicPlaceId,
      scannedAt: new Date().toISOString(),
      userRank,
      userReviewCount: clinicReviewCount,
      yelpRating,
      yelpReviewCount,
      yelpUrl,
      yelpRank,
      yelpCompetitors,
      healthgradesFound,
      healthgradesRating,
      healthgradesReviews,
      healthgradesClaimed,
      healthgradesUrl,
    };

    setCache(cacheKey, result);

    // ── 5. SAVE TO SUPABASE ───────────────────────────
    try {
      const { error: dbError } = await supabase.from("scans").insert({
        url,
        city,
        overall_score: overallScore,
        performance_score: performanceScore,
        seo_score: seoScore,
        accessibility_score: accessibilityScore,
        result,
        scanned_at: result.scannedAt,
      });
      if (dbError) console.error("Supabase insert error:", dbError.message);
      else console.log("✅ Scan saved to Supabase:", url, city);
    } catch (dbErr) {
      console.error("Supabase error:", dbErr);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit error:", error);
    return NextResponse.json(
      { error: "Failed to audit. Please check the URL and try again." },
      { status: 500 },
    );
  }
}
