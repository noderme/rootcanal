import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const event = JSON.parse(body);

    const eventType = event.event_type;
    console.log("🪝 Paddle webhook received:", eventType);

    // Handle subscription activated or payment completed
    if (
      eventType === "subscription.activated" ||
      eventType === "subscription.updated" ||
      eventType === "transaction.completed"
    ) {
      const data = event.data;

      // Extract customer info
      const email =
        data?.customer?.email || data?.billing_details?.email || null;

      const priceId =
        data?.items?.[0]?.price?.id ||
        data?.subscription_items?.[0]?.price?.id ||
        null;

      const subscriptionId = data?.id || null;
      const status = data?.status || "active";

      // Map price ID to plan name
      // 🔑 REPLACE these with your actual Paddle Price IDs from the dashboard
      const PRO_PRICE_ID = process.env.PADDLE_PRO_PRICE_ID || "pri_REPLACE_PRO";
      const GROWTH_PRICE_ID =
        process.env.PADDLE_GROWTH_PRICE_ID || "pri_REPLACE_GROWTH";

      const plan =
        priceId === PRO_PRICE_ID
          ? "pro"
          : priceId === GROWTH_PRICE_ID
            ? "growth"
            : "pro"; // default fallback

      if (email) {
        // Save subscriber to Supabase
        const { error } = await supabase.from("subscribers").upsert(
          {
            email,
            plan,
            subscription_id: subscriptionId,
            status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" },
        );

        if (error) {
          console.error("❌ Supabase upsert error:", error);
        } else {
          console.log(`✅ Subscriber saved: ${email} → ${plan}`);
        }
      }
    }

    // Handle subscription cancelled
    if (eventType === "subscription.canceled") {
      const email = event.data?.customer?.email;
      if (email) {
        await supabase
          .from("subscribers")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("email", email);
        console.log(`❌ Subscription cancelled: ${email}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
