import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input");

  if (!input || input.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // Google Places Autocomplete — restrict to USA cities only
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=(cities)&components=country:us&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    const suggestions =
      data.predictions
        ?.slice(0, 5)
        .map((p: { description: string }) => p.description) || [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Cities API error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
