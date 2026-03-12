import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID!;
const GROWTH_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const event = JSON.parse(body);
    const eventType: string = event.event_type;

    console.log("🪝 Paddle webhook received:", eventType);

    // ── NEW SUBSCRIPTION / PAYMENT ────────────────────────────────────────────
    if (
      eventType === "subscription.activated" ||
      eventType === "subscription.updated" ||
      eventType === "transaction.completed"
    ) {
      const data = event.data;

      // Customer email — Paddle always includes this on completed checkouts
      const email: string | null =
        data?.customer?.email ?? data?.billing_details?.email ?? null;

      if (!email) {
        console.warn("⚠️  No email in webhook payload — skipping");
        return NextResponse.json({ received: true });
      }

      // Price ID → plan
      const priceId: string | null =
        data?.items?.[0]?.price?.id ??
        data?.subscription_items?.[0]?.price?.id ??
        null;

      const plan =
        priceId === GROWTH_PRICE_ID
          ? "growth"
          : priceId === PRO_PRICE_ID
            ? "pro"
            : "pro"; // safe fallback

      // Paddle passes our customData straight through as data.custom_data
      // We set { clinicUrl } in paddle.ts — that's what arrives here
      const clinicUrl: string | null = data?.custom_data?.clinicUrl || null;

      const subscriptionId: string | null = data?.id ?? null;
      const status: string = data?.status ?? "active";

      console.log(`📦 Saving: ${email} → plan:${plan} | clinic:${clinicUrl}`);

      const { error } = await supabase.from("subscribers").upsert(
        {
          email,
          plan,
          subscription_id: subscriptionId,
          status,
          clinic_url: clinicUrl, // saved so dashboard can look up by URL
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );

      if (error) {
        console.error("❌ Supabase upsert error:", error);
        return NextResponse.json({ error: "DB write failed" }, { status: 500 });
      }

      console.log(`✅ Subscriber saved: ${email} → ${plan}`);
    }

    // ── SUBSCRIPTION CANCELLED ────────────────────────────────────────────────
    if (eventType === "subscription.canceled") {
      const email: string | null = event.data?.customer?.email ?? null;
      if (email) {
        await supabase
          .from("subscribers")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("email", email);
        console.log(`❌ Cancelled: ${email}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
