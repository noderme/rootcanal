/**
 * /api/audit-lite
 *
 * Lightweight version of /api/audit for the scraper.
 * Skips Healthgrades, Zocdoc, accessibility checks, and Supabase logging.
 * Returns: overallScore, seoScore, performanceScore, userRank, competitors (with googleRank).
 * Runs in ~2-3s vs 10s+ for the full audit.
 *
 * Params:
 *   url      — clinic website
 *   city     — optional, detected from Places if omitted
 *   placeId  — optional, clinic's Google place_id for rank detection
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
  userRank?: number;
  competitors: {
    name: string;
    rating: number;
    reviews: number;
    googleRank: number;
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
  const placeId = searchParams.get("placeId") || "";

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

    // 2. PageSpeed (performance + SEO only)
    const { performanceScore, seoScore } = await fetchPageSpeed(url, apiKey);
    const overallScore = Math.round((performanceScore + seoScore) / 2);

    // 3. Competitors from Google Places — real googleRank, find userRank if placeId provided
    type PlaceRow = { name: string; rating?: number; user_ratings_total?: number; place_id?: string };
    let competitors: LiteResult["competitors"] = [];
    let userRank: number | undefined;

    try {
      const placesRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=dental+clinic+in+${encodeURIComponent(city)}&key=${apiKey}`,
      );
      const placesData = await placesRes.json();

      const NON_CLINIC = ["university","college","school","hospital","institute","academy"];
      const filtered: PlaceRow[] = (placesData.results || []).filter(
        (p: PlaceRow) => !NON_CLINIC.some((kw) => p.name.toLowerCase().includes(kw)),
      );

      // Detect userRank from placeId
      if (placeId) {
        const idx = filtered.findIndex((p) => p.place_id === placeId);
        if (idx !== -1) userRank = idx + 1;
      }

      // Assign real googleRank, exclude user's own clinic
      competitors = filtered
        .map((p, i) => ({
          name: p.name,
          rating: p.rating ?? 0,
          reviews: p.user_ratings_total ?? 0,
          googleRank: i + 1,
          _placeId: p.place_id,
        }))
        .filter((c) => c._placeId !== placeId)
        .map(({ _placeId: _, ...rest }) => rest);
    } catch {
      /* return empty competitors */
    }

    const result: LiteResult = {
      url,
      city,
      overallScore,
      performanceScore,
      seoScore,
      userRank,
      competitors,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (error) {
    console.error("audit-lite error:", error);
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }
}
