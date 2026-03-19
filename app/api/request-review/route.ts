import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import twilio from "twilio";
import { getPostHogClient } from "@/lib/posthog-server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export async function POST(request: NextRequest) {
  try {
    const { contact, type, clinicName, clinicUrl, placeId, platform = "google", yelpUrl } =
      await request.json();

    if (!contact || !placeId) {
      return NextResponse.json(
        { error: "Contact and placeId required" },
        { status: 400 },
      );
    }

    const googleLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
    const reviewLink = platform === "yelp" && yelpUrl ? yelpUrl : googleLink;

    // ── 1. Save to Supabase ──
    const { error: dbError } = await supabase.from("review_requests").insert({
      contact,
      contact_type: type,
      clinic_name: clinicName,
      clinic_url: clinicUrl,
      place_id: placeId,
      review_link: reviewLink,
      status: "sent",
      created_at: new Date().toISOString(),
    });
    if (dbError) console.error("DB error:", dbError);

    // ── 2. Send email via Resend ──
    const makeEmailHtml = (buttonHtml: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 32px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 48px;">🦷</div>
          <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; margin: 12px 0 4px;">Thank you for visiting us!</h1>
          <p style="color: #888; font-size: 14px; margin: 0;">${clinicName}</p>
        </div>
        <p style="color: #444; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
          We hope your experience was a great one. If you have a moment, we'd love to hear your feedback — it helps other patients find us and helps us keep improving our care.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          ${buttonHtml}
        </div>
        <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 32px;">Takes less than 1 minute · Your feedback means the world to us</p>
        <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 24px 0;" />
        <p style="color: #ddd; font-size: 11px; text-align: center;">Sent via <a href="https://rootcanal.us" style="color: #1ABC9C; text-decoration: none;">RootCanal.us</a></p>
      </div>
    `;
    const googleBtn = `<a href="${googleLink}" style="background: #1ABC9C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">⭐ Leave a Google Review</a>`;
    const yelpBtn = yelpUrl ? `<a href="${yelpUrl}" style="background: #FF1A1A; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">⭐ Leave a Yelp Review</a>` : "";

    if (type === "email") {
      const sends: Promise<{ error: unknown }>[] = [];

      if (platform === "google" || platform === "both") {
        sends.push(resend.emails.send({
          from: `${clinicName} <hello@rootcanal.us>`,
          to: contact,
          subject: `How was your visit to ${clinicName}?`,
          html: makeEmailHtml(googleBtn),
        }));
      }
      if ((platform === "yelp" || platform === "both") && yelpUrl) {
        sends.push(resend.emails.send({
          from: `${clinicName} <hello@rootcanal.us>`,
          to: contact,
          subject: `Leave us a review on Yelp?`,
          html: makeEmailHtml(yelpBtn),
        }));
      }

      const results = await Promise.all(sends);
      const failed = results.find((r) => r.error);
      if (failed) {
        console.error("Resend error:", failed.error);
        return NextResponse.json(
          { error: "Failed to send email" },
          { status: 500 },
        );
      }
    } else if (type === "phone") {
      try {
        await twilioClient.messages.create({
          from: process.env.TWILIO_FROM_NUMBER,
          to: contact,
          body: platform === "both" && yelpUrl
            ? `Hi! Thank you for visiting ${clinicName}. We'd love your feedback!\nGoogle: ${googleLink}\nYelp: ${yelpUrl}\n(Takes less than 1 min!)`
            : `Hi! Thank you for visiting ${clinicName}. We'd love your feedback — leave us a quick ${platform === "yelp" ? "Yelp" : "Google"} review here: ${reviewLink} (takes less than 1 min!)`,
        });
      } catch (smsError) {
        console.error("Twilio error:", smsError);
        return NextResponse.json(
          { error: "Failed to send SMS" },
          { status: 500 },
        );
      }
    }

    try {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: clinicUrl || clinicName || "unknown",
        event: "review_request_sent",
        properties: { contact_type: type, platform, clinic_name: clinicName, clinic_url: clinicUrl },
      });
      await posthog.shutdown();
    } catch (phErr) {
      console.error("PostHog error:", phErr);
    }
    return NextResponse.json({ success: true, reviewLink });
  } catch (error) {
    console.error("Review request error:", error);
    return NextResponse.json(
      { error: "Failed to send review request" },
      { status: 500 },
    );
  }
}
