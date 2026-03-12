import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID!;
const GROWTH_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID!;

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const { email, priceId, clinicUrl } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const plan =
      priceId === GROWTH_PRICE_ID
        ? "growth"
        : priceId === PRO_PRICE_ID
          ? "pro"
          : "pro";

    const { error } = await supabase.from("subscribers").upsert(
      {
        email: email.toLowerCase().trim(),
        plan,
        status: "active",
        clinic_url: clinicUrl ? normalizeUrl(clinicUrl) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    if (error) {
      console.error("❌ activate-plan upsert error:", error);
      return NextResponse.json({ error: "DB write failed" }, { status: 500 });
    }

    console.log(`✅ Plan activated (client-side): ${email} → ${plan}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("activate-plan error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
