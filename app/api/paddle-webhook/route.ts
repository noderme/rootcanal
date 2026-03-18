import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPostHogClient } from "@/lib/posthog-server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID!;
const GROWTH_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID!;
const PADDLE_API_KEY = process.env.PADDLE_API_KEY!;

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

async function getCustomerEmail(customerId: string): Promise<string | null> {
  if (!PADDLE_API_KEY || !customerId) return null;
  try {
    const res = await fetch(`https://api.paddle.com/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
    });
    const json = await res.json();
    return json?.data?.email ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const event = JSON.parse(body);
    const eventType: string = event.event_type;

    console.log("🪝 Paddle webhook received:", eventType);
    console.log("🪝 Payload:", JSON.stringify(event.data, null, 2));

    // ── NEW SUBSCRIPTION / PAYMENT ────────────────────────────────────────────
    if (
      eventType === "subscription.activated" ||
      eventType === "subscription.updated" ||
      eventType === "transaction.completed"
    ) {
      const data = event.data;

      // Paddle Billing v2 webhooks don't include customer.email directly —
      // try inline fields first, then fall back to the Customers API
      let email: string | null =
        data?.customer?.email ??
        data?.billing_details?.email_address ??
        data?.billing_details?.email ??
        null;

      if (!email && data?.customer_id) {
        console.log("📞 Fetching email from Paddle API for:", data.customer_id);
        email = await getCustomerEmail(data.customer_id);
      }

      if (!email) {
        console.warn("⚠️  No email found — skipping. customer_id:", data?.customer_id);
        return NextResponse.json({ received: true });
      }

      // Price ID → plan
      const priceId: string | null =
        data?.items?.[0]?.price?.id ??
        data?.items?.[0]?.price_id ??
        data?.subscription_items?.[0]?.price?.id ??
        null;

      const plan =
        priceId === GROWTH_PRICE_ID
          ? "growth"
          : priceId === PRO_PRICE_ID
            ? "pro"
            : "pro"; // safe fallback

      const clinicUrl: string | null = data?.custom_data?.clinicUrl
        ? normalizeUrl(data.custom_data.clinicUrl)
        : null;

      const subscriptionId: string | null =
        data?.subscription_id ?? data?.id ?? null;
      // transaction.completed carries a transaction status ("completed"), not a subscription
      // status — always treat a completed transaction as an active subscription.
      const status: string =
        eventType === "transaction.completed"
          ? "active"
          : (data?.status ?? "active");

      console.log(`📦 Saving: ${email} → plan:${plan} | clinic:${clinicUrl}`);

      const { error } = await supabase.from("subscribers").upsert(
        {
          email,
          plan,
          subscription_id: subscriptionId,
          status,
          clinic_url: clinicUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );

      if (error) {
        console.error("❌ Supabase upsert error:", error);
        return NextResponse.json({ error: "DB write failed" }, { status: 500 });
      }

      console.log(`✅ Subscriber saved: ${email} → ${plan}`);
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: email,
        event: "subscription_created",
        properties: { plan, clinic_url: clinicUrl, subscription_id: subscriptionId, paddle_event: eventType },
      });
      await posthog.shutdown();
    }

    // ── SUBSCRIPTION CANCELLED ────────────────────────────────────────────────
    if (eventType === "subscription.canceled") {
      const data = event.data;
      let email: string | null = data?.customer?.email ?? null;
      if (!email && data?.customer_id) {
        email = await getCustomerEmail(data.customer_id);
      }
      if (email) {
        await supabase
          .from("subscribers")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("email", email);
        console.log(`❌ Cancelled: ${email}`);
        const posthog = getPostHogClient();
        posthog.capture({
          distinctId: email,
          event: "subscription_cancelled",
          properties: { subscription_id: data?.id ?? null },
        });
        await posthog.shutdown();
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
