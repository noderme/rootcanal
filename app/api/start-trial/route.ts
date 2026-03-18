import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const { email, clinicUrl } = await request.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    // Check if already a paying subscriber — don't downgrade
    const { data: existing } = await supabase
      .from("subscribers")
      .select("status, plan")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing?.status === "active") {
      return NextResponse.json({ plan: "pro", alreadyActive: true });
    }

    const now = new Date().toISOString();
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("subscribers").upsert(
      {
        email: email.toLowerCase().trim(),
        clinic_url: clinicUrl || null,
        plan: "trial",
        status: "trialing",
        trial_started_at: now,
        trial_ends_at: trialEnds,
        updated_at: now,
      },
      { onConflict: "email" },
    );

    if (error) {
      console.error("start-trial upsert error:", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    return NextResponse.json({ plan: "trial", trialEndsAt: trialEnds });
  } catch (err) {
    console.error("start-trial error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
