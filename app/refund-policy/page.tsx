import Link from "next/link";

export const metadata = {
  title: "Refund Policy | RootCanal",
  description:
    "Refund Policy for RootCanal — dental SEO and Google visibility tool.",
};

export default function RefundPage() {
  return (
    <main
      style={{
        background: "#F7F3ED",
        minHeight: "100vh",
        padding: "60px 24px",
        fontFamily: "'DM Sans', sans-serif",
        color: "#1A1410",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 48 }}>
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: "#C0392B",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Back to RootCanal
          </Link>
        </div>

        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 38,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Refund Policy
        </h1>
        <p style={{ fontSize: 14, color: "#888", marginBottom: 48 }}>
          Last updated: March 12, 2026
        </p>

        {[
          {
            title: "1. Free Tier",
            body: "RootCanal offers a free audit report that requires no payment. There is nothing to refund for free usage of the Service.",
          },
          {
            title: "2. 7-Day Money-Back Guarantee",
            body: 'If you subscribe to a paid plan (Pro at $49/month or Growth at $99/month) and are not satisfied for any reason, you may request a full refund within 7 days of your first payment. To request a refund, email us at hello@rootcanal.us with the subject line "Refund Request" and include the email address used to subscribe. We will process your refund within 5 business days.',
          },
          {
            title: "3. Refunds After 7 Days",
            body: "After the 7-day period, subscription payments are non-refundable. You may cancel your subscription at any time to prevent future charges. Cancellation takes effect at the end of your current billing period and you will retain access to Pro features until that date.",
          },
          {
            title: "4. How to Cancel",
            body: "To cancel your subscription, email hello@rootcanal.us with your account email address and we will cancel your subscription immediately. You will not be charged again after cancellation.",
          },
          {
            title: "5. Exceptions",
            body: "We reserve the right to refuse refunds if we detect abuse of the refund policy, such as repeatedly subscribing and refunding. In cases of suspected fraud or violation of our Terms and Conditions, refunds may be withheld.",
          },
          {
            title: "6. Payment Processing",
            body: "All payments are processed by Paddle, who acts as the Merchant of Record. Refunds will be returned to the original payment method used at checkout. Processing times may vary depending on your bank or card issuer.",
          },
          {
            title: "7. Contact",
            body: "For any refund requests or billing questions, contact us at hello@rootcanal.us. We aim to respond within 1 business day.",
          },
        ].map((section) => (
          <div key={section.title} style={{ marginBottom: 36 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 10,
                fontFamily: "'Playfair Display', serif",
              }}
            >
              {section.title}
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "#3A3330" }}>
              {section.body}
            </p>
          </div>
        ))}

        <div
          style={{
            marginTop: 60,
            paddingTop: 32,
            borderTop: "1px solid rgba(0,0,0,0.1)",
            fontSize: 13,
            color: "#888",
          }}
        >
          © 2026 RootCanal. All rights reserved. ·{" "}
          <Link href="/" style={{ color: "#C0392B", textDecoration: "none" }}>
            rootcanal.us
          </Link>
          {" · "}
          <Link
            href="/terms-and-conditions"
            style={{ color: "#C0392B", textDecoration: "none" }}
          >
            Terms
          </Link>
          {" · "}
          <Link
            href="/privacy-policy"
            style={{ color: "#C0392B", textDecoration: "none" }}
          >
            Privacy
          </Link>
        </div>
      </div>
    </main>
  );
}
