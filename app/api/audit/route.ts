import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ──────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ── IN-MEMORY CACHE ───────────────────────────────────────
const cache = new Map<string, { data: AuditResult; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface AuditResult {
  url: string;
  city: string;
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
  let city = searchParams.get("city") || "";

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY || "";

  // ── Auto-detect city from Google Places if not provided ──
  if (!city) {
    try {
      // Normalize URL: strip protocol + www
      const normalizedUrl = url
        .replace(/https?:\/\//, "")
        .replace(/^www\./, "");

      // Strategy 1: Search by website URL directly — most accurate
      const byWebsite = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(normalizedUrl)}&type=dentist&key=${apiKey}`,
      );
      const websiteData = await byWebsite.json();
      let address = websiteData.results?.[0]?.formatted_address || "";

      console.log("🏙️ Strategy 1 (by URL):", normalizedUrl, "→", address);

      // Strategy 2 fallback: search domain words + dental + region=us
      if (!address || address.toLowerCase().includes("india")) {
        const clinicQuery = normalizedUrl
          .split("/")[0]
          .replace(/\.(com|net|org|io|us)$/, "")
          .replace(/\.my\.canva\.site$/, "")
          .replace(/[-_.]/g, " ");
        const byName = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(clinicQuery + " dental")}&region=us&type=dentist&key=${apiKey}`,
        );
        const nameData = await byName.json();
        address = nameData.results?.[0]?.formatted_address || "";
        console.log("🏙️ Strategy 2 (by name):", clinicQuery, "→", address);
      }

      // Parse "Street, City, State ZIP, USA" → "City, ST"
      if (address && !address.toLowerCase().includes("india")) {
        const parts = address.split(",");
        if (parts.length >= 3) {
          const cityPart = parts[parts.length - 3].trim();
          const statePart = parts[parts.length - 2].trim();
          const stateCode = statePart.replace(/\s\d{5}.*/, "").trim();
          if (/^[A-Z]{2}$/.test(stateCode)) {
            city = `${cityPart}, ${stateCode}`;
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

  const cacheKey = `${url}__${city}`.toLowerCase();

  // ── Check cache first ──
  const cached = getCached(cacheKey);
  if (cached) {
    console.log("Cache hit:", cacheKey);
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
    try {
      // Search by clinic name + city for more reliable match
      const clinicSearchName = url
        .replace(/https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .replace(/\.my\.canva\.site$/, "")
        .replace(/\.(com|net|org|io|us)$/, "")
        .replace(/[-_.]/g, " ")
        .trim();
      const gbpQuery = `${clinicSearchName} dentist ${city}`;
      const gbpUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(gbpQuery)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total,business_status,formatted_address&key=${apiKey}`;
      const gbpRes = await fetch(gbpUrl);
      const gbpData = await gbpRes.json();
      const place = gbpData.candidates?.[0];
      // Only use if address doesn't contain India
      if (
        place?.place_id &&
        !place.formatted_address?.toLowerCase().includes("india")
      ) {
        clinicPlaceId = place.place_id;
      }

      if (!place?.place_id) {
        issues.push({
          title: "Google Business Profile not found",
          desc: "Your clinic doesn't appear on Google Maps. This is the #1 way patients find dentists near them.",
          priority: "HIGH",
          status: "fail",
        });
      } else if (!place.rating || place.user_ratings_total < 5) {
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
            // Score based on Google ranking position
            // Position 1 = 90, Position 2 = 85, etc.
            // Adjusted by rating quality
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

    // ── 4. SAVE TO SUPABASE ───────────────────────────
    try {
      const { error: dbError } = await supabase.from("scans").insert({
        url,
        city,
        overall_score: overallScore,
        performance_score: performanceScore,
        seo_score: seoScore,
        accessibility_score: accessibilityScore,
      });

      if (dbError) {
        console.error("Supabase insert error:", dbError.message);
      } else {
        console.log("✅ Scan saved to Supabase:", url, city);
      }
    } catch (dbErr) {
      // Never crash the API if DB fails
      console.error("Supabase error:", dbErr);
    }

    // ── 5. Cache & return ─────────────────────────────
    const result: AuditResult = {
      url,
      city,
      overallScore,
      performanceScore,
      seoScore,
      accessibilityScore,
      issues,
      competitors,
      placeId: clinicPlaceId,
      scannedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit error:", error);
    return NextResponse.json(
      { error: "Failed to audit. Please check the URL and try again." },
      { status: 500 },
    );
  }
}
