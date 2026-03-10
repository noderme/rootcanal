import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicName = searchParams.get("name");
  const city = searchParams.get("city");

  if (!clinicName || !city) {
    return NextResponse.json(
      { error: "Clinic name and city required" },
      { status: 400 },
    );
  }

  const googleKey = process.env.GOOGLE_API_KEY || "";

  try {
    // ── 1. Find place_id from clinic name + city ──
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(clinicName + " " + city)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total&key=${googleKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    const place = searchData.candidates?.[0];
    if (!place?.place_id) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    // ── 2. Fetch reviews using place_id ──
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
        message: "No reviews found for this clinic",
      });
    }

    // ── 3. Format reviews for Claude ──
    const reviewText = reviews
      .map(
        (r: { author_name: string; rating: number; text: string }) =>
          `[${r.rating}⭐] ${r.author_name}: "${r.text}"`,
      )
      .join("\n\n");

    // ── 4. Analyze with Claude API ──
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
  "sentiment": "positive" | "mixed" | "negative",
  "summary": "One sentence summary of overall patient experience"
}`,
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    console.log("Claude status:", claudeRes.status);
    console.log("Claude response:", JSON.stringify(claudeData));
    const rawText = claudeData.content?.[0]?.text || "{}";

    let analysis;
    try {
      analysis = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch {
      analysis = null;
    }

    // ── 5. Return everything ──
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
