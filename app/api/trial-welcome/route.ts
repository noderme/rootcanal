import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, trialEndsAt } = await request.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const endsDate = trialEndsAt
      ? new Date(trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "7 days from now";

    const { error } = await resend.emails.send({
      from: "RootCanal <hello@rootcanal.us>",
      to: email,
      subject: "Your RootCanal free trial has started",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 32px; background: #ffffff;">
          <div style="margin-bottom: 28px;">
            <div style="font-size: 36px; margin-bottom: 12px;">🦷</div>
            <h1 style="color: #1a1a1a; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Your free trial is now active</h1>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0;">
              You now have full access to all Pro features on RootCanal until <strong>${endsDate}</strong> — no credit card required.
            </p>
          </div>

          <p style="color: #444; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
            Most clinics begin seeing stronger local visibility when they consistently collect new patient reviews.
          </p>

          <div style="background: #f0faf7; border-left: 3px solid #1ABC9C; border-radius: 4px; padding: 14px 18px; margin-bottom: 28px;">
            <p style="margin: 0; color: #1a1a1a; font-size: 15px; font-weight: 600;">
              A good first step is to send your first review request today.
            </p>
          </div>

          <p style="color: #444; font-size: 14px; font-weight: 600; margin-bottom: 10px;">During your trial you can:</p>
          <ul style="margin: 0 0 28px; padding-left: 20px; color: #555; font-size: 14px; line-height: 2.1;">
            <li>Track nearby competitors and local visibility changes</li>
            <li>Send automated review requests by email or SMS</li>
            <li>Monitor how your patient discovery is evolving</li>
            <li>Follow a simple growth roadmap based on your current position</li>
          </ul>

          <div style="margin-bottom: 32px;">
            <a href="https://rootcanal.us/dashboard" style="background: #1ABC9C; color: #000000; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">
              Open your dashboard →
            </a>
          </div>

          <p style="color: #888; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
            Your free trial ends on ${endsDate}.<br/>
            Upgrade anytime to continue protecting and improving your local rankings.
          </p>

          <p style="color: #444; font-size: 14px; margin-bottom: 0;">— The RootCanal Team</p>

          <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 24px 0;" />
          <p style="color: #ddd; font-size: 11px; text-align: center; margin: 0;">
            <a href="https://rootcanal.us" style="color: #1ABC9C; text-decoration: none;">RootCanal.us</a> — Dental practice growth platform
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Trial welcome error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
