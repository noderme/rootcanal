import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicUrl = searchParams.get("url");
  const clinicName = searchParams.get("name");
  const city = searchParams.get("city") || "";

  const googleKey = process.env.GOOGLE_API_KEY || "";

  try {
    // ── 1. Find place by URL + city to avoid wrong location matches ──
    const domain = clinicUrl
      ? clinicUrl
          .replace(/https?:\/\//, "")
          .replace(/www\./, "")
          .split("/")[0]
      : "";

    // Always include city in query to avoid matching wrong location
    const query = city
      ? `${domain || clinicName} dentist ${city}`
      : `${domain || clinicName}`;

    // Use locationbias to restrict to USA
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total,formatted_address&locationbias=rectangle:-125,24,-66,50&key=${googleKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    // Validate result is in correct location (not India or wrong country)
    const place = searchData.candidates?.[0];
    if (!place?.place_id) {
      return NextResponse.json({
        rating: 0,
        total: 0,
        reviews: [],
        sentimentBreakdown: null,
        responseRate: 0,
        analysis: null,
      });
    }

    // Check address doesn't contain India/wrong country
    const placeAddress = place.formatted_address || "";
    if (
      placeAddress.toLowerCase().includes("india") ||
      placeAddress.toLowerCase().includes("hyderabad") ||
      placeAddress.toLowerCase().includes("telangana")
    ) {
      return NextResponse.json({
        rating: 0,
        total: 0,
        reviews: [],
        sentimentBreakdown: null,
        responseRate: 0,
        analysis: null,
      });
    }

    // ── 2. Fetch reviews + details ──
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,user_ratings_total,reviews&key=${googleKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    const reviews = detailsData.result?.reviews || [];
    const rating = detailsData.result?.rating || 0;
    const total = detailsData.result?.user_ratings_total || 0;

    if (reviews.length === 0) {
      return NextResponse.json({
        rating,
        total,
        reviews: [],
        analysis: null,
        sentiment: null,
      });
    }

    // ── 3. Calculate sentiment breakdown ──
    const positive = reviews.filter(
      (r: { rating: number }) => r.rating >= 4,
    ).length;
    const neutral = reviews.filter(
      (r: { rating: number }) => r.rating === 3,
    ).length;
    const negative = reviews.filter(
      (r: { rating: number }) => r.rating <= 2,
    ).length;
    const total_r = reviews.length;

    const sentimentBreakdown = {
      positive: Math.round((positive / total_r) * 100),
      neutral: Math.round((neutral / total_r) * 100),
      negative: Math.round((negative / total_r) * 100),
    };

    // ── 4. Calculate response rate ──
    const responded = reviews.filter(
      (r: { owner_response?: { text: string } }) => r.owner_response?.text,
    ).length;
    const responseRate = Math.round((responded / total_r) * 100);

    // ── 5. Format reviews for Claude ──
    const reviewText = reviews
      .map(
        (r: { author_name: string; rating: number; text: string }) =>
          `[${r.rating}⭐] ${r.author_name}: "${r.text}"`,
      )
      .join("\n\n");

    // ── 6. Analyze with Claude ──
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
        messages: [
          {
            role: "user",
            content: `You are analyzing Google reviews for a dental clinic. Based on these reviews, provide a JSON analysis.

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
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || "{}";

    let analysis;
    try {
      analysis = JSON.parse(rawText.replace(/\`\`\`json|\`\`\`/g, "").trim());
    } catch {
      analysis = null;
    }

    return NextResponse.json({
      rating,
      total,
      reviews: reviews.map(
        (r: {
          author_name: string;
          rating: number;
          text: string;
          relative_time_description: string;
        }) => ({
          author: r.author_name,
          rating: r.rating,
          text: r.text,
          time: r.relative_time_description,
        }),
      ),
      sentimentBreakdown,
      responseRate,
      analysis,
    });
  } catch (error) {
    console.error("Reviews error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}
