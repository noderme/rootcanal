/**
 * /api/audit-lite
 *
 * Lightweight version of /api/audit for the scraper.
 * Skips Healthgrades, Zocdoc, accessibility checks, and Supabase logging.
 * Returns: overallScore, seoScore, performanceScore, userRank, reviewGap, competitors.
 *
 * Params:
 *   url      — clinic website
 *   city     — optional, detected from Places if omitted
 *   placeId  — optional, clinic's Google place_id for rank + nearbysearch
 *
 * reviewGap logic:
 *   rank 1–20  → gap vs #1 (top competitor)
 *   rank > 20  → gap vs rank ~20 (closest visible competitor just ahead)
 *   no rank    → gap vs #1 (city-wide top)
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
  reviewGap: number | null;
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
        if (attempt < 2) { await sleep(3000); continue; }
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

  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

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
        const domain = url.replace(/https?:\/\//, "").replace(/^www\./, "").split("/")[0];
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(domain + " dentist")}&type=dentist&key=${apiKey}`,
        );
        const data = await res.json();
        const top = data.results?.[0];
        if (top?.formatted_address && !top.formatted_address.toLowerCase().includes("india")) {
          city = parseCityFromAddress(top.formatted_address) || city;
        }
      } catch { /* use passed city */ }
    }
    if (!city) city = "New York, NY";

    // 2. PageSpeed
    const { performanceScore, seoScore } = await fetchPageSpeed(url, apiKey);
    const overallScore = Math.round((performanceScore + seoScore) / 2);

    // 3. Get clinic lat/lng from placeId for accurate nearbysearch
    let clinicLat: number | undefined;
    let clinicLng: number | undefined;
    if (placeId) {
      try {
        const detailsRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${apiKey}`,
        );
        const detailsData = await detailsRes.json();
        clinicLat = detailsData.result?.geometry?.location?.lat;
        clinicLng = detailsData.result?.geometry?.location?.lng;
      } catch { /* fall through to textsearch */ }
    }

    // 4. Competitors — nearbysearch if we have lat/lng, textsearch otherwise
    type PlaceRow = { name: string; rating?: number; user_ratings_total?: number; place_id?: string };
    let competitors: LiteResult["competitors"] = [];
    let userRank: number | undefined;
    let reviewGap: number | null = null;

    try {
      const placesUrl = clinicLat != null && clinicLng != null
        ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${clinicLat},${clinicLng}&radius=5000&type=dentist&key=${apiKey}`
        : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=dental+clinic+in+${encodeURIComponent(city)}&key=${apiKey}`;

      const placesRes = await fetch(placesUrl);
      const placesData = await placesRes.json();

      const NON_CLINIC = ["university","college","school","hospital","institute","academy"];
      const filtered: PlaceRow[] = (placesData.results || []).filter(
        (p: PlaceRow) => !NON_CLINIC.some((kw) => p.name.toLowerCase().includes(kw)),
      );

      // Detect userRank
      if (placeId) {
        const idx = filtered.findIndex((p) => p.place_id === placeId);
        if (idx !== -1) userRank = idx + 1;
      }

      // Assign real googleRank, exclude user's own clinic
      const ranked = filtered
        .map((p, i) => ({
          name: p.name,
          rating: p.rating ?? 0,
          reviews: p.user_ratings_total ?? 0,
          googleRank: i + 1,
          _placeId: p.place_id,
        }))
        .filter((c) => c._placeId !== placeId)
        .map(({ _placeId: _, ...rest }) => rest);

      competitors = ranked;

      // reviewGap logic
      if (ranked.length > 0) {
        const top = ranked[0]; // rank #1 nearby
        const closestAhead = ranked[ranked.length - 1]; // last in list = boundary competitor

        if (!userRank || userRank <= 20) {
          // In top 20 or unknown — compare with #1
          reviewGap = top.reviews;
        } else {
          // Beyond top 20 — compare with closest visible competitor ahead
          reviewGap = closestAhead.reviews;
        }
      }
    } catch { /* return empty */ }

    const result: LiteResult = {
      url, city, overallScore, performanceScore, seoScore,
      userRank, reviewGap, competitors,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);
  } catch (error) {
    console.error("audit-lite error:", error);
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }
}
