export const metadata = {
  title: "Privacy Policy | RootCanal",
  description:
    "Privacy Policy for RootCanal — dental SEO and Google visibility tool.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p style={{ fontSize: 14, color: "#888", marginBottom: 48 }}>
          Last updated: March 12, 2026
        </p>

        {[
          {
            title: "1. Who We Are",
            body: 'RootCanal ("we", "us", "our") operates the website rootcanal.us. We provide Google visibility reports and SEO tools for dental clinics in the United States. For privacy-related questions, contact us at hello@rootcanal.us.',
          },
          {
            title: "2. What Information We Collect",
            body: "We collect the following information: (a) Website URLs submitted by users for scanning; (b) Email addresses voluntarily provided when signing up, upgrading to a paid plan, or submitting a lead form; (c) Patient email addresses or phone numbers entered into our review request tool — these are used solely to send a single review request on behalf of the clinic and are not stored beyond what is necessary to deliver that request; (d) Basic usage data such as pages visited, browser type, and referring URLs, collected via analytics tools.",
          },
          {
            title: "3. How We Use Your Information",
            body: "We use collected information to: provide and improve the Service; send audit reports and monthly updates to subscribers; process subscription payments via Paddle; send review request emails on behalf of dental clinic users; respond to support inquiries; and analyse usage patterns to improve the product. We do not use your data for advertising purposes.",
          },
          {
            title: "4. Legal Basis for Processing",
            body: "We process your data on the basis of: contractual necessity (to deliver the Service you signed up for); legitimate interests (to improve our product and prevent abuse); and consent (where you have explicitly opted in, such as subscribing to email updates).",
          },
          {
            title: "5. Data Sharing",
            body: "We do not sell your personal data. We share data only with trusted third-party service providers necessary to operate the Service, including: Paddle (payment processing); Supabase (database hosting); Resend (transactional email delivery); Google APIs (Maps, Places, PageSpeed — for generating reports); and Anthropic (AI-powered review analysis). All providers are contractually bound to protect your data.",
          },
          {
            title: "6. Review Request Tool",
            body: "When a dental clinic user enters a patient's email or phone number to send a review request, that contact information is used solely to deliver a single review request message. By using this feature, the clinic user confirms they have the patient's consent to be contacted. We do not use patient contact details for any other purpose, and we do not store them beyond what is necessary to send the request.",
          },
          {
            title: "7. Cookies",
            body: "We use essential cookies to operate the Service (e.g. maintaining your session). We may also use analytics cookies to understand how users interact with our site. You can disable cookies in your browser settings, though this may affect functionality.",
          },
          {
            title: "8. Data Retention",
            body: "We retain your account data for as long as your account is active. Scan results are cached for up to 24 hours. If you cancel your subscription or request deletion, we will remove your personal data within 30 days, except where we are required to retain it for legal or accounting purposes.",
          },
          {
            title: "9. Your Rights",
            body: "You have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion of your data; withdraw consent at any time where processing is based on consent; and lodge a complaint with a relevant data protection authority. To exercise any of these rights, email us at hello@rootcanal.us.",
          },
          {
            title: "10. Data Security",
            body: "We implement industry-standard security measures including HTTPS encryption, secure database hosting via Supabase, and restricted access to production systems. While we take security seriously, no system is completely immune to risk.",
          },
          {
            title: "11. Children's Privacy",
            body: "RootCanal is not directed at children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has submitted data to us, please contact us immediately at hello@rootcanal.us.",
          },
          {
            title: "12. Changes to This Policy",
            body: "We may update this Privacy Policy from time to time. We will notify subscribers of material changes via email. The date at the top of this page indicates when the policy was last revised. Continued use of the Service after changes constitutes acceptance.",
          },
          {
            title: "13. Contact Us",
            body: "For any privacy-related questions or requests, contact us at hello@rootcanal.us. We aim to respond within 5 business days.",
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
          {" · "}
          <a
            href="/terms-and-conditions"
            style={{ color: "#C0392B", textDecoration: "none" }}
          >
            Terms and Conditions
          </a>
        </div>
      </div>
    </main>
  );
}
