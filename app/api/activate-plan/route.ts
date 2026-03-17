import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // This endpoint is intentionally disabled.
  // Plan activation must come from verified Paddle webhooks to prevent anyone
  // from self-upgrading by calling an unauthenticated API route.
  void req;
  return NextResponse.json(
    { error: "Deprecated: activation happens via Paddle webhook." },
    { status: 410 },
  );
}
