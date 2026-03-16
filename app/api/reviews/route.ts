import { NextRequest, NextResponse } from "next/server";

const THREE_MONTHS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;

function isWithinThreeMonths(timestamp: number): boolean {
  return timestamp * 1000 >= THREE_MONTHS_AGO;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicUrl = searchParams.get("url");
  const clinicName = searchParams.get("name") || "";
  const city = searchParams.get("city") || "";
  const plan = searchParams.get("plan") || "free";
  const isPaid = plan === "pro" || plan === "growth";

  const googleKey = process.env.GOOGLE_API_KEY || "";
  const serpapiKey = process.env.SERPAPI_KEY || "";
  const apifyKey = process.env.APIFY_API_KEY || "";

  try {
    // ── 1. Find Google place ──────────────────────────
    const domain = clinicUrl
      ? clinicUrl.replace(/https?:\/\//, "").replace(/www\./, "").split("/")[0]
      : "";

    const query = city
      ? `${domain || clinicName} dentist ${city}`
      : `${domain || clinicName}`;

    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total,formatted_address&locationbias=rectangle:-125,24,-66,50&key=${googleKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const place = searchData.candidates?.[0];

    if (!place?.place_id) {
      return NextResponse.json({ rating: 0, total: 0, reviews: [], sentimentBreakdown: null, responseRate: 0, analysis: null });
    }

    const placeAddress = place.formatted_address || "";
    if (placeAddress.toLowerCase().includes("india") || placeAddress.toLowerCase().includes("hyderabad")) {
      return NextResponse.json({ rating: 0, total: 0, reviews: [], sentimentBreakdown: null, responseRate: 0, analysis: null });
    }

    // ── 2. Fetch Google reviews ───────────────────────
    type RawReview = { author_name: string; rating: number; text: string; time: number; relative_time_description: string; owner_response?: { text: string } };
    let googleReviews: RawReview[] = [];
    let rating = 0;
    let total = 0;

    if (isPaid && apifyKey) {
      // Pro/Growth: use Apify Google Maps for more reviews
      try {
        const apifyRes = await fetch(
          `https://api.apify.com/v2/acts/compass~google-maps-reviews-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=60`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placeIds: [place.place_id], maxReviews: 50, reviewsSort: "newest" }),
            signal: AbortSignal.timeout(65000),
          }
        );
        const apifyData = await apifyRes.json();
        const placeData = Array.isArray(apifyData) ? apifyData[0] : null;
        if (placeData?.reviews?.length > 0) {
          googleReviews = placeData.reviews
            .filter((r: { publishedAtDate?: string; stars?: number; text?: string }) => {
              if (!r.publishedAtDate) return true;
              return new Date(r.publishedAtDate).getTime() >= THREE_MONTHS_AGO;
            })
            .map((r: { name?: string; stars?: number; text?: string; publishedAtDate?: string; ownerAnswer?: string }) => ({
              author_name: r.name || "Anonymous",
              rating: r.stars || 0,
              text: r.text || "",
              time: r.publishedAtDate ? Math.floor(new Date(r.publishedAtDate).getTime() / 1000) : 0,
              relative_time_description: r.publishedAtDate ? new Date(r.publishedAtDate).toLocaleDateString() : "",
              owner_response: r.ownerAnswer ? { text: r.ownerAnswer } : undefined,
            }));
          rating = placeData.totalScore || 0;
          total = placeData.reviewsCount || 0;
        }
      } catch {
        // fall through to Places API
      }
    }

    // Free plan or Apify failed — use Places API (5 reviews)
    if (googleReviews.length === 0) {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,user_ratings_total,reviews&key=${googleKey}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();
      googleReviews = detailsData.result?.reviews || [];
      rating = detailsData.result?.rating || 0;
      total = detailsData.result?.user_ratings_total || 0;
    }

    // ── 3. Fetch Yelp reviews via SerpAPI ─────────────
    type YelpReview = { author_name: string; rating: number; text: string; time: number; relative_time_description: string; source: string };
    let yelpReviews: YelpReview[] = [];

    if (serpapiKey && clinicName) {
      try {
        // First get the Yelp business ID
        const yelpSearchRes = await fetch(
          `https://serpapi.com/search.json?engine=yelp&find_desc=${encodeURIComponent("dentist")}&find_loc=${encodeURIComponent(city || "New York")}&api_key=${serpapiKey}`,
          { signal: AbortSignal.timeout(10000) }
        );
        const yelpSearchData = await yelpSearchRes.json();
        const yelpResults = yelpSearchData?.organic_results || [];
        const clinicNameLower = clinicName.toLowerCase();
        // SerpAPI Yelp uses `title` for the business name
        const yelpBiz = yelpResults.find((r: { title?: string; name?: string }) => {
          const n = (r.title || r.name || "").toLowerCase();
          return n.includes(clinicNameLower.split(" ")[0]) || clinicNameLower.includes(n.split(" ")[0]);
        });

        if (yelpBiz?.place_ids?.yelp) {
          const yelpId = yelpBiz.place_ids.yelp;
          const limit = isPaid ? 50 : 5;
          const yelpReviewsRes = await fetch(
            `https://serpapi.com/search.json?engine=yelp_reviews&place_id=${yelpId}&api_key=${serpapiKey}`,
            { signal: AbortSignal.timeout(10000) }
          );
          const yelpReviewsData = await yelpReviewsRes.json();
          const rawYelp = yelpReviewsData?.reviews || [];
          yelpReviews = rawYelp
            .filter((r: { date?: string }) => {
              if (!isPaid || !r.date) return true;
              return new Date(r.date).getTime() >= THREE_MONTHS_AGO;
            })
            .slice(0, limit)
            .map((r: { user?: { name?: string }; rating?: number; comment?: { text?: string }; date?: string }) => ({
              author_name: r.user?.name || "Yelp User",
              rating: r.rating || 0,
              text: r.comment?.text || "",
              time: r.date ? Math.floor(new Date(r.date).getTime() / 1000) : 0,
              relative_time_description: r.date || "",
              source: "yelp",
            }));
        }
      } catch {
        // silently fail
      }
    }

    // ── 4. Combine reviews ────────────────────────────
    type CombinedReview = { author_name: string; rating: number; text: string; time: number; relative_time_description: string; source: string; owner_response?: { text: string } };
    const allReviews: CombinedReview[] = [
      ...googleReviews.map(r => ({ ...r, source: "google" })),
      ...yelpReviews,
    ].filter(r => r.text);

    if (allReviews.length === 0) {
      return NextResponse.json({ rating, total, reviews: [], sentimentBreakdown: null, responseRate: 0, analysis: null });
    }

    // ── 5. Sentiment breakdown ────────────────────────
    const positive = allReviews.filter(r => r.rating >= 4).length;
    const neutral = allReviews.filter(r => r.rating === 3).length;
    const negative = allReviews.filter(r => r.rating <= 2).length;
    const totalR = allReviews.length;

    const sentimentBreakdown = {
      positive: Math.round((positive / totalR) * 100),
      neutral: Math.round((neutral / totalR) * 100),
      negative: Math.round((negative / totalR) * 100),
    };

    // ── 6. Response rate (Google only) ────────────────
    const responded = googleReviews.filter(r => r.owner_response?.text).length;
    const responseRate = googleReviews.length > 0 ? Math.round((responded / googleReviews.length) * 100) : 0;

    // ── 7. Claude analysis ────────────────────────────
    const reviewText = allReviews
      .map(r => `[${r.rating}⭐][${r.source === "yelp" ? "Yelp" : "Google"}] ${r.author_name}: "${r.text}"`)
      .join("\n\n");

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `You are analyzing Google and Yelp reviews for a dental clinic. Based on these ${allReviews.length} reviews, provide a JSON analysis.

Reviews:
${reviewText}

Respond ONLY with valid JSON in this exact format, no other text:
{
  "loves": ["thing patients love 1", "thing patients love 2", "thing patients love 3"],
  "complaints": ["complaint 1", "complaint 2", "complaint 3"],
  "fixNow": ["urgent fix 1", "urgent fix 2"],
  "promote": ["what to promote 1", "what to promote 2"],
  "sentiment": "positive",
  "summary": "One sentence summary of overall patient experience"
}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || "{}";
    let analysis;
    try {
      analysis = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch {
      analysis = null;
    }

    return NextResponse.json({
      rating,
      total,
      reviews: allReviews.map(r => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.relative_time_description,
        source: r.source,
      })),
      sentimentBreakdown,
      responseRate,
      analysis,
      reviewSources: {
        google: googleReviews.length,
        yelp: yelpReviews.length,
      },
    });

  } catch (error) {
    console.error("Reviews error:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}
