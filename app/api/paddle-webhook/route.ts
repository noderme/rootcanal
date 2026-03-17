import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID!;
const GROWTH_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID!;
const PADDLE_API_KEY = process.env.PADDLE_API_KEY!;
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET!;

function parsePaddleSignatureHeader(value: string | null): {
  ts: string | null;
  h1: string | null;
} {
  if (!value) return { ts: null, h1: null };
  const parts = value.split(";").map((p) => p.trim());
  const kv = new Map<string, string>();
  for (const part of parts) {
    const [k, ...rest] = part.split("=");
    if (!k || rest.length === 0) continue;
    kv.set(k, rest.join("="));
  }
  return { ts: kv.get("ts") ?? null, h1: kv.get("h1") ?? null };
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verifyPaddleWebhook({
  rawBody,
  signatureHeader,
}: {
  rawBody: string;
  signatureHeader: string | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!PADDLE_WEBHOOK_SECRET) {
    return { ok: false, reason: "Missing PADDLE_WEBHOOK_SECRET" };
  }
  const { ts, h1 } = parsePaddleSignatureHeader(signatureHeader);
  if (!ts || !h1) return { ok: false, reason: "Missing ts/h1" };

  // Basic replay protection (5 minutes)
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "Invalid ts" };
  const skewMs = Math.abs(Date.now() - tsNum * 1000);
  if (skewMs > 5 * 60 * 1000) return { ok: false, reason: "Stale ts" };

  const computed = crypto
    .createHmac("sha256", PADDLE_WEBHOOK_SECRET)
    .update(`${ts}:${rawBody}`, "utf8")
    .digest("hex");

  if (!timingSafeEqualHex(computed, h1)) {
    return { ok: false, reason: "Bad signature" };
  }
  return { ok: true };
}

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
    const verify = verifyPaddleWebhook({
      rawBody: body,
      signatureHeader: req.headers.get("paddle-signature"),
    });
    if (!verify.ok) {
      console.warn("⚠️ Paddle webhook rejected:", verify.reason);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

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
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
