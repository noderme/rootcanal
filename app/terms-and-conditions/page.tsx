export const metadata = {
  title: "Terms and Conditions | RootCanal",
  description:
    "Terms and Conditions for RootCanal — dental SEO and Google visibility tool.",
};

export default function TermsPage() {
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
          <a
            href="/"
            style={{
              fontSize: 13,
              color: "#C0392B",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Back to RootCanal
          </a>
        </div>

        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 38,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Terms and Conditions
        </h1>
        <p style={{ fontSize: 14, color: "#888", marginBottom: 48 }}>
          Last updated: March 12, 2026
        </p>

        {[
          {
            title: "1. Acceptance of Terms",
            body: 'By accessing or using RootCanal ("the Service") at rootcanal.us, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Service. These terms apply to all visitors, users, and subscribers.',
          },
          {
            title: "2. Description of Service",
            body: "RootCanal provides dental clinic owners with Google visibility reports, local search ranking analysis, competitor insights, patient review analysis, and review request automation tools. Free reports are available to all users. Pro and Growth subscription plans unlock additional features including monthly automated reports and competitor tracking.",
          },
          {
            title: "3. Subscriptions and Payments",
            body: "Paid subscriptions are billed on a monthly recurring basis. Payments are processed securely via Paddle. By subscribing, you authorise us to charge your payment method each billing cycle. All prices are in USD. You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period — no partial refunds are issued.",
          },
          {
            title: "4. Refund Policy",
            body: "We offer a 7-day money-back guarantee on your first subscription payment. If you are unsatisfied for any reason within 7 days of your first charge, contact us at hello@rootcanal.us and we will issue a full refund. After 7 days, payments are non-refundable.",
          },
          {
            title: "5. Free Tier",
            body: "The free audit report is provided as-is with no guarantees of accuracy or completeness. We reserve the right to limit the number of free scans per user or IP address at our discretion.",
          },
          {
            title: "6. Data and Privacy",
            body: "RootCanal collects website URLs and email addresses submitted by users. We use this data solely to provide the Service. We do not sell your data to third parties. By submitting a patient's email address to our review request tool, you confirm you have the patient's consent to contact them. Please review our Privacy Policy for full details.",
          },
          {
            title: "7. Accuracy of Reports",
            body: "Reports are generated using publicly available data from Google Maps, Google PageSpeed, and other third-party sources. Rankings and scores are estimates and may not reflect exact real-time positions. RootCanal makes no guarantees regarding improvements in search rankings as a result of using the Service.",
          },
          {
            title: "8. Acceptable Use",
            body: "You agree not to misuse the Service, including but not limited to: submitting competitors' websites to generate reports for malicious purposes, attempting to reverse-engineer the platform, using automated bots to generate excessive scans, or using the review request tool to send unsolicited messages to individuals who have not consented.",
          },
          {
            title: "9. Intellectual Property",
            body: "All content, branding, code, and design on rootcanal.us is the property of RootCanal and may not be copied, reproduced, or distributed without written permission.",
          },
          {
            title: "10. Limitation of Liability",
            body: "To the maximum extent permitted by law, RootCanal shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability to you shall not exceed the amount you paid us in the 30 days prior to the claim.",
          },
          {
            title: "11. Modifications",
            body: "We reserve the right to update these Terms at any time. We will notify subscribers of material changes via email. Continued use of the Service after changes constitutes acceptance of the new Terms.",
          },
          {
            title: "12. Governing Law",
            body: "These Terms are governed by the laws of the State of Delaware, United States. Any disputes shall be resolved in the courts of the United States.",
          },
          {
            title: "13. Contact",
            body: "For questions about these Terms, contact us at hello@rootcanal.us.",
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
          <a href="/" style={{ color: "#C0392B", textDecoration: "none" }}>
            rootcanal.us
          </a>
        </div>
      </div>
    </main>
  );
}
