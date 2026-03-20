import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeRankStats } from "@/lib/rankSmoothing";
import { mergeCompetitorHistory, type CompetitorHistory } from "@/lib/competitorHistory";
import { getPostHogClient } from "@/lib/posthog-server";

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
    googleRank: number;
    lat?: number;
    lng?: number;
    appearances?: number; // total scans this competitor has been seen in (from history)
    firstSeen?: string;   // ISO 8601 — first observation timestamp
    lastSeen?: string;    // ISO 8601 — most recent observation timestamp
  }[];
  placeId: string;
  userLat?: number;
  userLng?: number;
  scannedAt: string;
  userRank?: number;
  userReviewCount?: number;
  userRating?: number;
  gbpPhotoCount?: number;
  gbpHasHours?: boolean;
  gbpHasWebsite?: boolean;
  gbpHasPhone?: boolean;
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
  notInTop60?: boolean;
  cached?: boolean;
  smoothedRank?: number;
  rankRangeLow?: number;
  rankRangeHigh?: number;
  stableCompetitorCount?: number;
  competitorCountOutlier?: boolean;
  lastUpdatedAt?: string;
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
  const url = searchParams.get("url") || "";
  const nameParam = searchParams.get("name") || "";
  const cityParam = searchParams.get("city") || "";
  const force = searchParams.get("force") === "true";
  const hasWebsite = !!url;

  if (!hasWebsite && (!nameParam || !cityParam)) {
    return NextResponse.json({ error: "Either url or name+city required" }, { status: 400 });
  }

  // For no-website path, city is provided directly; for website path, we detect it
  let city = hasWebsite ? "" : cityParam;

  const apiKey = process.env.GOOGLE_API_KEY || "";

  // ── Check Supabase cache FIRST — before any expensive API calls ──
  if (!force) {
    try {
      const earlyCacheKey = hasWebsite ? url.toLowerCase() : `${nameParam.toLowerCase()}-${cityParam.toLowerCase()}`;
      const since = new Date(Date.now() - CACHE_TTL).toISOString();
      const { data: cachedRow } = await supabase
        .from("scans")
        .select("result, scanned_at")
        .eq("url", hasWebsite ? url : earlyCacheKey)
        .not("result", "is", null)
        .gte("scanned_at", since)
        .order("scanned_at", { ascending: false })
        .limit(1)
        .single();

      if (cachedRow?.result) {
        console.log("Early Supabase cache hit:", earlyCacheKey);
        return NextResponse.json({
          ...cachedRow.result,
          cached: true,
          lastUpdatedAt: cachedRow.scanned_at,
        });
      }
    } catch {
      // No cache hit — proceed with full audit
    }
  }

  // ── Dental clinic check — reject non-dental websites ──
  if (hasWebsite) try {
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
      // Domain name and page content don't have dental keywords.
      // Allow through anyway — non-obvious domain names are common (e.g. drsmithseattle.com).
      // The audit itself will fail gracefully if it truly can't find the clinic.
      console.log("⚠️ No dental keywords found — allowing through for:", url);
    }
  } catch (e) {
    console.error("Dental check error:", e);
  }

  // ── Auto-detect city from website content + Google Places (website mode only) ──
  let cityDetectionPlaceId: string | null = null;
  let cityDetectionName: string | null = null;
  const inputDomain = hasWebsite
    ? url.replace(/https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase()
    : "";

  if (hasWebsite && !city) {
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

  const cacheKey = hasWebsite
    ? url.toLowerCase()
    : `${nameParam.toLowerCase()}-${cityParam.toLowerCase()}`;

  // ── Check Supabase cache first (persistent across serverless invocations) ──
  if (!force) {
    try {
      const since = new Date(Date.now() - CACHE_TTL).toISOString();
      const { data: cachedRow } = await supabase
        .from("scans")
        .select("result, scanned_at")
        .eq("url", hasWebsite ? url : cacheKey)
        .not("result", "is", null)
        .gte("scanned_at", since)
        .order("scanned_at", { ascending: false })
        .limit(1)
        .single();

      if (cachedRow?.result) {
        console.log("Supabase cache hit:", cacheKey);
        return NextResponse.json({
          ...cachedRow.result,
          cached: true,
          lastUpdatedAt: cachedRow.scanned_at,
        });
      }
    } catch {
      // No cache hit — proceed with full audit
    }
  }

  // ── Check in-memory cache (fallback for same instance) ──
  if (!force) {
    const cached = getCached(cacheKey);
    if (cached && cached.placeId) {
      console.log("Memory cache hit:", cacheKey);
      return NextResponse.json({ ...cached, lastUpdatedAt: cached.scannedAt });
    }
  }

  try {
    // ── 1. PAGESPEED (website mode only) ──────────────
    let performanceScore = 0;
    let seoScore = 0;
    let accessibilityScore = 0;
    let audits: Record<string, { score: number | null }> = {};

    if (hasWebsite) {
      const ps = await fetchPageSpeed(url, apiKey);
      performanceScore = ps.performanceScore;
      seoScore = ps.seoScore;
      accessibilityScore = ps.accessibilityScore;
      audits = ps.audits;
    }

    // If all 3 scores are 0, PageSpeed API failed — default to 50 to avoid showing 0/100
    const pageSpeedFailed =
      performanceScore === 0 && seoScore === 0 && accessibilityScore === 0;
    const overallScore = !hasWebsite
      ? 0
      : pageSpeedFailed
      ? 50
      : Math.round((performanceScore + seoScore + accessibilityScore) / 3);

    // ── 2. ISSUES ─────────────────────────────────────
    const issues: {
      title: string;
      desc: string;
      priority: string;
      status: string;
    }[] = [];

    if (hasWebsite) {
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
    } // end hasWebsite issues block

    // ── 3. GOOGLE BUSINESS PROFILE CHECK ────────────
    let clinicPlaceId = "";
    let clinicName: string | undefined;
    let clinicReviewCount: number | undefined;
    let clinicRating: number | undefined;
    let clinicLat: number | undefined;
    let clinicLng: number | undefined;
    let gbpPhotoCount = 0;
    let gbpHasHours = false;
    let gbpHasWebsite = false;
    let gbpHasPhone = false;
    try {
      const clinicSearchName = hasWebsite
        ? url
            .replace(/https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0]
            .replace(/\.my\.canva\.site$/, "")
            .replace(/\.(com|net|org|io|us)$/, "")
            .replace(/[-_.]/g, " ")
            .trim()
        : nameParam;

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
        website?: string;
        formatted_phone_number?: string;
        opening_hours?: { periods?: unknown[] };
        photos?: unknown[];
      } | null = null;

      // Strategy 0: reuse placeId already found during city detection (most reliable)
      if (cityDetectionPlaceId && !clinicPlaceId) {
        const matched = await websiteMatches(cityDetectionPlaceId);
        if (matched) {
          // Fetch full details for this placeId
          const s0Res = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${cityDetectionPlaceId}&fields=place_id,name,rating,user_ratings_total,formatted_address,geometry,website,formatted_phone_number,opening_hours,photos&key=${apiKey}`,
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
        const gbpUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(gbpQuery)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total,business_status,formatted_address,geometry&key=${apiKey}`;
        const gbpRes = await fetch(gbpUrl);
        const gbpData = await gbpRes.json();
        place = gbpData.candidates?.[0];

        if (place?.place_id && !isIndia(place)) {
          // No-website mode: skip website match check — name+city is the identity
          const matched = hasWebsite ? await websiteMatches(place.place_id) : true;
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

      // Strategy 2: fallback — search by website URL via textsearch (website mode only)
      if (!clinicPlaceId && hasWebsite) {
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

      // For strategies 1 & 2, the place object came from a search result which
      // lacks extended fields. Fetch them now if we have a placeId and the
      // extended fields aren't already present.
      if (clinicPlaceId && place && !("opening_hours" in place) && !("photos" in place)) {
        try {
          const extRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${clinicPlaceId}&fields=website,formatted_phone_number,opening_hours,photos&key=${apiKey}`,
          );
          const extData = await extRes.json();
          if (extData.result) {
            place = { ...place, ...extData.result };
          }
        } catch {
          // non-critical — GBP signals will just show as unknown
        }
      }

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
      if (place?.rating != null) clinicRating = place.rating;
      if (place?.geometry?.location?.lat != null) clinicLat = place.geometry.location.lat;
      if (place?.geometry?.location?.lng != null) clinicLng = place.geometry.location.lng;
      gbpPhotoCount = place?.photos ? (place.photos as unknown[]).length : 0;
      gbpHasHours = !!(place?.opening_hours?.periods?.length);
      gbpHasWebsite = !!(place?.website);
      gbpHasPhone = !!(place?.formatted_phone_number);
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

    // ── 3b. SERPAPI ACCURATE RANK DETECTION (runs first so Places can paginate smartly) ───
    let userRank: number | undefined;
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

    // ── 5. COMPETITORS via Google Places (paginated, windowed around userRank) ──────────
    let competitors: {
      name: string;
      rating: number;
      reviews: number;
      address: string;
      googleRank: number;
    }[] = [];
    let notInTop60 = false;

    try {
      const NON_CLINIC_KEYWORDS = ["university","college","school","hospital","nyu","columbia","institute","academy","clinic at"];

      type PlaceResult = { name: string; rating?: number; user_ratings_total?: number; formatted_address?: string; place_id?: string; geometry?: { location?: { lat?: number; lng?: number } } };

      const baseUrl = clinicLat != null && clinicLng != null
        ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${clinicLat},${clinicLng}&radius=5000&type=dentist&key=${apiKey}`
        : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=dental+clinic+in+${encodeURIComponent(city)}&key=${apiKey}`;

      // Determine how many pages we need:
      // We want min(15, userRank-1) ahead + the user row + min(5, ...) behind
      // Worst case: userRank=60 → need all 3 pages (60 results)
      // If userRank unknown, fetch 1 page and try to find them
      const pagesNeeded = !userRank ? 1 : userRank <= 20 ? 1 : userRank <= 40 ? 2 : 3;

      const allPlaces: PlaceResult[] = [];
      let nextPageToken: string | undefined;

      for (let page = 0; page < pagesNeeded; page++) {
        const pageUrl = page === 0
          ? baseUrl
          : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextPageToken}&key=${apiKey}`;

        if (page > 0) {
          // Google requires a short delay before the next_page_token is valid
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const res = await fetch(pageUrl);
        const data = await res.json();
        console.log(`Places page ${page + 1} status:`, data.status);

        const pageResults: PlaceResult[] = (data.results || []).filter(
          (p: PlaceResult) => !NON_CLINIC_KEYWORDS.some(kw => p.name.toLowerCase().includes(kw))
        );
        allPlaces.push(...pageResults);
        nextPageToken = data.next_page_token;
        if (!nextPageToken) break;
      }

      // Fallback rank detection from Places if SerpAPI didn't find them
      if (!userRank && clinicPlaceId) {
        const rankIndex = allPlaces.findIndex(p => p.place_id === clinicPlaceId);
        if (rankIndex !== -1) {
          userRank = rankIndex + 1;
          console.log(`📍 Places fallback rank: #${userRank}`);
        }
      }

      // If still not found after fetching all available pages, user is beyond top 60
      if (!userRank) {
        notInTop60 = true;
        console.log("📍 Clinic not found in top 60 results");
      }

      if (allPlaces.length > 0) {
        // Assign real Google ranks across all pages
        const ranked = allPlaces.map((place, index) => ({
          name: place.name,
          rating: place.rating ?? 0,
          reviews: place.user_ratings_total ?? 0,
          address: place.formatted_address ?? "",
          googleRank: index + 1,
          lat: place.geometry?.location?.lat,
          lng: place.geometry?.location?.lng,
          _placeId: place.place_id,
        }));

        // Exclude user's own clinic
        const withoutUser = ranked.filter(c => c._placeId !== clinicPlaceId);

        if (userRank) {
          // Window: up to 15 ahead + up to 5 behind
          const ahead = withoutUser.filter(c => c.googleRank < userRank!).slice(-15); // last 15 = closest to user
          const behind = withoutUser.filter(c => c.googleRank > userRank!).slice(0, 5);
          competitors = [...ahead, ...behind].map(({ _placeId: _, ...rest }) => rest);
        } else {
          // Not found — show top 15 as all "ahead"
          competitors = withoutUser.slice(0, 15).map(({ _placeId: _, ...rest }) => rest);
        }
      }
    } catch (placesError) {
      console.error("Places error:", placesError);
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
      userLat: clinicLat,
      userLng: clinicLng,
      userRank,
      userReviewCount: clinicReviewCount,
      userRating: clinicRating,
      gbpPhotoCount,
      gbpHasHours,
      gbpHasWebsite,
      gbpHasPhone,
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
      notInTop60,
    };

    // ── Historical scans (shared by rank smoothing + competitor frequency) ──
    try {
      const { data: historicalScans } = await supabase
        .from("scans")
        .select("result")
        .eq("url", hasWebsite ? url : cacheKey)
        .not("result", "is", null)
        .order("scanned_at", { ascending: false })
        .limit(4); // last 4 prior scans + current = N=5

      const priorScans = (historicalScans ?? []) as { result: AuditResult }[];

      // ── Rank smoothing ──────────────────────────────
      if (userRank != null) {
        const historicalRanks = priorScans
          .map((row) => row.result?.userRank)
          .filter((r): r is number => typeof r === "number")
          .reverse(); // oldest first
        const stats = computeRankStats(userRank, historicalRanks);
        result.smoothedRank = stats.smoothedRank;
        result.rankRangeLow = stats.rankRangeLow;
        result.rankRangeHigh = stats.rankRangeHigh;
      }

      // ── Competitor history (persistent) ────────────
      // Fetch the stored history row for this clinic, merge in current scan,
      // then enrich result.competitors with appearances / firstSeen / lastSeen.
      {
        let existingHistory: CompetitorHistory = [];
        try {
          const { data: histRow } = await supabase
            .from("competitor_history")
            .select("competitors")
            .eq("clinic_key", hasWebsite ? url : cacheKey)
            .single();
          if (histRow?.competitors) existingHistory = histRow.competitors as CompetitorHistory;
        } catch { /* table may not exist yet — degrade gracefully */ }

        const now = result.scannedAt;
        const updatedHistory = mergeCompetitorHistory(
          existingHistory,
          result.competitors.map((c) => ({ name: c.name, googleRank: c.googleRank })),
          now,
        );

        // Enrich result competitors from history
        const byName = new Map(updatedHistory.map((o) => [o.normalizedName, o]));
        result.competitors = result.competitors.map((c) => {
          const obs = byName.get((c.name ?? "").toLowerCase().trim());
          return obs
            ? { ...c, appearances: obs.appearances, firstSeen: obs.firstSeen, lastSeen: obs.lastSeen }
            : c;
        });

        // Persist updated history (upsert — creates row on first scan)
        try {
          await supabase.from("competitor_history").upsert({
            clinic_key: hasWebsite ? url : cacheKey,
            city,
            competitors: updatedHistory,
            updated_at: now,
          }, { onConflict: "clinic_key" });
        } catch { /* non-critical */ }
      }

      // ── Competitor count outlier guard ──────────────
      // Protects the stable displayed count from extreme single-scan swings.
      // Needs at least 2 prior snapshots to establish a baseline.
      const historicalCounts = priorScans
        .map((row) => row.result?.competitors?.length)
        .filter((n): n is number => typeof n === "number");

      if (historicalCounts.length >= 2) {
        const sorted = [...historicalCounts].sort((a, b) => a - b);
        const medianCount = sorted[Math.floor(sorted.length / 2)];
        const rawCount = result.competitors.length;
        const deviation = Math.abs(rawCount - medianCount) / Math.max(medianCount, 1);

        if (deviation > 0.5) {
          // Current count deviates > 50% from the rolling median.
          // Check whether the immediately prior scan ALSO deviated — if so,
          // two consecutive outlier readings confirm a genuine shift; accept it.
          const prevCount = historicalCounts[0]; // index 0 = most recent prior (DESC)
          const prevDeviation = Math.abs(prevCount - medianCount) / Math.max(medianCount, 1);
          if (prevDeviation > 0.5) {
            // Confirmed: reality has shifted — accept raw count as new stable
            result.stableCompetitorCount = rawCount;
            result.competitorCountOutlier = false;
          } else {
            // Single outlier: hold the median as stable count, flag for UI
            result.stableCompetitorCount = medianCount;
            result.competitorCountOutlier = true;
          }
        } else {
          result.stableCompetitorCount = rawCount;
          result.competitorCountOutlier = false;
        }
      }
    } catch {
      // non-critical — smoothing/frequency fails gracefully
    }

    setCache(cacheKey, result);

    // ── 5. SAVE TO SUPABASE ───────────────────────────
    try {
      const { error: dbError } = await supabase.from("scans").insert({
        url: hasWebsite ? url : cacheKey,
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

    // ── 5b. REVIEW SNAPSHOTS (one row per clinic per day) ─────────────────
    try {
      const clinicKey = hasWebsite ? url : cacheKey;
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      // Clinic snapshot — ignore conflict if already recorded today
      if (clinicReviewCount != null) {
        await supabase.from("review_snapshots").upsert(
          {
            clinic_url: clinicKey,
            place_id: clinicPlaceId || null,
            review_count: clinicReviewCount,
            rating: clinicRating != null ? clinicRating : null,
            snapshot_date: today,
          },
          { onConflict: "clinic_url,snapshot_date", ignoreDuplicates: true },
        );
      }

      // Competitor snapshots — one row per competitor per day
      for (const comp of competitors) {
        await supabase.from("competitor_snapshots").upsert(
          {
            clinic_url: clinicKey,
            competitor_name: comp.name,
            place_id: null, // not fetched per-competitor during audit
            review_count: comp.reviews ?? null,
            rating: comp.rating ?? null,
            google_rank: comp.googleRank ?? null,
            snapshot_date: today,
          },
          { onConflict: "clinic_url,competitor_name,snapshot_date", ignoreDuplicates: true },
        );
      }

      console.log("✅ Review snapshots saved for", clinicKey);
    } catch (snapErr) {
      console.error("Snapshot insert error:", snapErr);
    }

    result.lastUpdatedAt = result.scannedAt;
    try {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: result.url,
        event: "audit_completed",
        properties: {
          clinic_url: result.url,
          city: result.city,
          overall_score: result.overallScore,
          performance_score: result.performanceScore,
          seo_score: result.seoScore,
          google_rank: result.userRank ?? null,
        },
      });
      await posthog.shutdown();
    } catch (phErr) {
      console.error("PostHog error:", phErr);
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
