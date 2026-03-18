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
      subject: "Your 7-day free trial has started 🦷",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 32px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="font-size: 48px;">🦷</div>
            <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; margin: 12px 0 4px;">Your free trial is live</h1>
            <p style="color: #888; font-size: 14px; margin: 0;">Full Pro access until ${endsDate}</p>
          </div>

          <p style="color: #444; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
            You now have full access to all Pro features on RootCanal — no credit card needed.
          </p>

          <div style="background: #f9f9f9; border-radius: 8px; padding: 20px 24px; margin-bottom: 28px;">
            <p style="margin: 0 0 12px; font-weight: 700; color: #1a1a1a; font-size: 14px;">What's unlocked during your trial:</p>
            <ul style="margin: 0; padding-left: 20px; color: #444; font-size: 14px; line-height: 2;">
              <li>Competitor tracking &amp; ranking map</li>
              <li>Automated review request emails &amp; SMS</li>
              <li>Monthly re-scans to track your progress</li>
              <li>Patient intelligence &amp; growth roadmap</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="https://rootcanal.us/dashboard" style="background: #1ABC9C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">
              Open my dashboard →
            </a>
          </div>

          <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 32px;">
            Your trial ends on ${endsDate}. After that, upgrade to keep your rankings protected.
          </p>
          <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 24px 0;" />
          <p style="color: #ddd; font-size: 11px; text-align: center;">
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
