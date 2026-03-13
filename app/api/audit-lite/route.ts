/**
 * /api/audit-lite
 *
 * Lightweight version of /api/audit for the scraper.
 * Skips Healthgrades, Zocdoc, accessibility checks, and Supabase logging.
 * Returns only what the scraper needs: overallScore, seoScore, performanceScore, competitors.
 * Runs in ~2-3s vs 10s+ for the full audit.
 *
 * Place this file at: app/api/audit-lite/route.ts
 */

import { NextRequest, NextResponse } from "next/server";

const cache = new Map<string, { data: LiteResult; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface LiteResult {
  url: string;
  city: string;
  overallScore: number;
  performanceScore: number;
  seoScore: number;
  competitors: {
    name: string;
    rating: number;
    reviews: number;
    score: number;
  }[];
  cached?: boolean;
}

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPageSpeed(url: string, apiKey: string) {
  const psUrl = [
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
    `?url=${encodeURIComponent(url)}`,
    `&key=${apiKey}`,
    "&strategy=mobile",
    "&category=performance",
    "&category=seo",
  ].join("");

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(psUrl);
      const data = await res.json();
      if (res.status === 429) {
        if (attempt < 2) {
          await sleep(3000);
          continue;
        }
        return { performanceScore: 50, seoScore: 50 };
      }
      const cats = data?.lighthouseResult?.categories ?? {};
      return {
        performanceScore: Math.round((cats?.performance?.score ?? 0.5) * 100),
        seoScore: Math.round((cats?.seo?.score ?? 0.5) * 100),
      };
    } catch {
      if (attempt < 2) await sleep(2000);
    }
  }
  return { performanceScore: 50, seoScore: 50 };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  let city = searchParams.get("city") || "";

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY || "";
  const cacheKey = url.toLowerCase();

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    // 1. Detect city from Google Places if not provided
    if (!city) {
      try {
        const domain = url
          .replace(/https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0];
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(domain + " dentist")}&type=dentist&key=${apiKey}`,
        );
        const data = await res.json();
        const top = data.results?.[0];
        if (
          top?.formatted_address &&
          !top.formatted_address.toLowerCase().includes("india")
        ) {
          city = parseCityFromAddress(top.formatted_address) || city;
        }
      } catch {
        /* use passed city */
      }
    }

    if (!city) city = "New York, NY";

    // 2. PageSpeed (performance + SEO only — skip accessibility)
    const { performanceScore, seoScore } = await fetchPageSpeed(url, apiKey);
    const overallScore = Math.round((performanceScore + seoScore) / 2);

    // 3. Competitors from Google Places
    let competitors: LiteResult["competitors"] = [];
    try {
      const placesRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=dental+clinic+in+${encodeURIComponent(city)}&key=${apiKey}`,
      );
      const placesData = await placesRes.json();

      const NON_CLINIC = [
        "university",
        "college",
        "school",
        "hospital",
        "institute",
        "academy",
      ];
      competitors = (placesData.results || [])
        .filter(
          (p: { name: string }) =>
            !NON_CLINIC.some((kw) => p.name.toLowerCase().includes(kw)),
        )
        .slice(0, 7)
        .map(
          (
            p: { name: string; rating?: number; user_ratings_total?: number },
            i: number,
          ) => ({
            name: p.name,
            rating: p.rating ?? 0,
            reviews: p.user_ratings_total ?? 0,
            score: Math.min(
              95,
              Math.max(
                30,
                Math.round(90 - i * 7 + ((p.rating ?? 0) - 4.0) * 5),
              ),
            ),
          }),
        );
    } catch {
      /* return empty competitors */
    }

    const result: LiteResult = {
      url,
      city,
      overallScore,
      performanceScore,
      seoScore,
      competitors,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (error) {
    console.error("audit-lite error:", error);
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }
}
