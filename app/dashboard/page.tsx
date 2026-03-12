"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { initPaddle, openProCheckout } from "@/lib/paddle";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface AuditData {
  url: string;
  city: string;
  overallScore: number;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  issues: { title: string; desc: string; priority: string; status: string }[];
  competitors: {
    name: string;
    rating: number;
    reviews: number;
    address: string;
    score: number;
  }[];
  placeId: string;
  scannedAt: string;
}

interface ReviewData {
  rating: number;
  total: number;
  reviews: { author: string; rating: number; text: string; time: string }[];
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  } | null;
  responseRate: number;
  analysis: {
    loves: string[];
    complaints: string[];
    fixNow: string[];
    promote: string[];
    sentiment: string;
    summary: string;
  } | null;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#2ECC71" : score >= 40 ? "#F0A500" : "#E74C3C";

  const toothLabel =
    score >= 80
      ? "Perfect Health"
      : score >= 60
        ? "Minor Cavities"
        : score >= 40
          ? "Needs Filling"
          : "Critical";

  // SVG tooth that degrades based on score
  const ToothSVG = () => {
    if (score >= 80) {
      // Perfect — clean white tooth
      return (
        <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
          <path
            d="M8 6 C8 2 14 0 22 0 C30 0 36 2 36 6 C40 8 44 14 44 22 C44 32 40 44 36 48 C34 52 30 52 28 48 C26 44 24 40 22 40 C20 40 18 44 16 48 C14 52 10 52 8 48 C4 44 0 32 0 22 C0 14 4 8 8 6Z"
            fill="white"
            stroke="#E0D9D0"
            strokeWidth="1.5"
          />
          <path
            d="M14 8 C14 6 17 5 22 5 C27 5 30 6 30 8"
            stroke="#F0EBE3"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      );
    } else if (score >= 60) {
      // Minor cavities — small brown spots
      return (
        <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
          <path
            d="M8 6 C8 2 14 0 22 0 C30 0 36 2 36 6 C40 8 44 14 44 22 C44 32 40 44 36 48 C34 52 30 52 28 48 C26 44 24 40 22 40 C20 40 18 44 16 48 C14 52 10 52 8 48 C4 44 0 32 0 22 C0 14 4 8 8 6Z"
            fill="#F5F0E8"
            stroke="#C8B89A"
            strokeWidth="1.5"
          />
          <circle cx="15" cy="18" r="3" fill="#8B6914" opacity="0.6" />
          <circle cx="29" cy="22" r="2.5" fill="#8B6914" opacity="0.5" />
          <circle cx="20" cy="28" r="2" fill="#7A5C10" opacity="0.4" />
        </svg>
      );
    } else if (score >= 40) {
      // Needs filling — big cavities, yellowed
      return (
        <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
          <path
            d="M8 6 C8 2 14 0 22 0 C30 0 36 2 36 6 C40 8 44 14 44 22 C44 32 40 44 36 48 C34 52 30 52 28 48 C26 44 24 40 22 40 C20 40 18 44 16 48 C14 52 10 52 8 48 C4 44 0 32 0 22 C0 14 4 8 8 6Z"
            fill="#E8D5A0"
            stroke="#A07830"
            strokeWidth="2"
          />
          <ellipse
            cx="14"
            cy="17"
            rx="5"
            ry="4"
            fill="#5C3A0A"
            opacity="0.75"
          />
          <ellipse cx="30" cy="20" rx="4" ry="5" fill="#5C3A0A" opacity="0.7" />
          <ellipse
            cx="20"
            cy="30"
            rx="5"
            ry="3.5"
            fill="#4A2E08"
            opacity="0.65"
          />
          <path
            d="M16 12 Q22 10 28 13"
            stroke="#8B6020"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    } else {
      // Critical — cracked, broken, dark
      return (
        <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
          <path
            d="M8 6 C8 2 14 0 22 0 C30 0 36 2 36 6 C40 8 44 14 44 22 C44 32 40 44 36 48 C34 52 30 52 28 48 C26 44 24 40 22 40 C20 40 18 44 16 48 C14 52 10 52 8 48 C4 44 0 32 0 22 C0 14 4 8 8 6Z"
            fill="#6B4A2A"
            stroke="#3D2810"
            strokeWidth="2"
          />
          <path
            d="M22 2 L19 14 L24 20 L18 36"
            stroke="#2A1A08"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M10 10 L14 18"
            stroke="#2A1A08"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M32 12 L28 22"
            stroke="#2A1A08"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <ellipse cx="14" cy="22" rx="5" ry="4" fill="#1A0A00" opacity="0.9" />
          <ellipse cx="30" cy="26" rx="4" ry="5" fill="#1A0A00" opacity="0.9" />
        </svg>
      );
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <ToothSVG />
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg
          width="140"
          height="140"
          viewBox="0 0 120 120"
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#2A3330"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.5s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 48,
              fontWeight: 900,
              color,
              lineHeight: 1,
            }}
          >
            {score}
          </div>
          <div style={{ fontSize: 13, color: "#6B7B78" }}>/ 100</div>
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        {toothLabel}
      </div>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || "";

  const [data, setData] = useState<AuditData | null>(null);
  const city = searchParams.get("city") || data?.city || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [patientValue, setPatientValue] = useState(150);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "competitors" | "roadmap" | "reviews" | "score" | "health"
  >("competitors");
  const [reviewContact, setReviewContact] = useState("");
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Initialize Paddle when component mounts
  useEffect(() => {
    initPaddle();
  }, []);

  // TODO: Set to true once Paddle account is fully verified and payouts enabled
  const handleUpgradeClick = () => setShowUpgradePopup(true);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  const fixGuides: Record<string, string[]> = {
    "Doesn't work on phones": [
      "Contact your website developer and ask them to make your site 'mobile responsive'",
      "If you use WordPress, install a mobile-friendly theme like Astra or GeneratePress",
      "Test your site at google.com/test/mobile-friendly — share results with your developer",
    ],
    "Website is too slow": [
      "Ask your web developer to compress all images on your website",
      "Switch to faster web hosting — SiteGround or Cloudflare are good options",
      "Install Cloudflare (free) — it speeds up any website automatically",
      "Forward this to your developer: enable browser caching and minify CSS/JS files",
    ],
    "Website could be faster": [
      "Ask your web developer to compress images — this alone can double your speed",
      "Enable browser caching on your website",
      "Consider upgrading your web hosting plan",
    ],
    "Google can't find your clinic": [
      "Make sure your page title includes your city — e.g. 'Family Dentist in Austin TX'",
      "Add your city name naturally throughout your homepage text",
      "Create a Google Business Profile at business.google.com if you haven't already",
      "List your clinic on Yelp, Healthgrades and Zocdoc — all free",
    ],
    "Google visibility needs work": [
      "Add your city name to your homepage title and first paragraph",
      "Create a separate page for each service you offer (teeth whitening, braces, etc.)",
      "Ask satisfied patients to leave a Google review — more reviews = higher ranking",
    ],
    "Missing Google search preview": [
      "This is called a 'meta description' — it's the text Google shows under your clinic name in search results",
      "Ask your web developer to add a meta description to every page",
      "Example: 'Family dental clinic in Austin TX. Accepting new patients. Call us today!'",
      "Keep it under 160 characters and include your city name",
    ],
    "Missing clinic name on Google": [
      "Ask your web developer to add a proper page title to your website",
      "Good example: 'Austin Family Dental | Dentist in Austin TX'",
      "This should include your clinic name and city",
    ],
    "Images not labeled": [
      "Ask your web developer to add 'alt text' to all images on your website",
      "Alt text describes what's in each image — e.g. 'Dental exam room at Austin Family Dental'",
      "This helps Google understand your website better and improves ranking",
    ],
    "Not listed on Healthgrades": [
      "Go to healthgrades.com and search for your clinic",
      "If your clinic appears but is unclaimed, click 'Is this you?' and claim it",
      "If it doesn't appear, go to healthgrades.com/dentists and add your practice",
      "Fill in everything — address, phone, hours, services, and a photo",
      "Ask satisfied patients to leave a review on Healthgrades too",
    ],
    "Not listed on Zocdoc": [
      "Go to zocdoc.com/join and sign up as a provider — it's free to list",
      "Fill in your profile completely — specialty, insurance accepted, location",
      "Enable online booking — patients love clinics they can book instantly",
      "Zocdoc sends you patients directly — many dentists get 10-20 new patients/month from it",
    ],
    "Google Business Profile not found": [
      "Go to business.google.com and click 'Manage now'",
      "Search for your clinic name — if it exists, claim it. If not, create it.",
      "Fill in EVERYTHING — clinic name, address, phone, hours, photos, services",
      "Add at least 10 photos — exterior, interior, staff, treatment rooms",
      "Once verified, ask every patient to leave a Google review",
      "This is the single most important thing you can do to get more patients from Google",
    ],
    "Google Business Profile needs attention": [
      "Log in to your Google Business Profile at business.google.com",
      "Make sure your clinic name, address and phone number are 100% correct",
      "Add your opening hours, website link and list of services",
      "Upload at least 10 photos — patients trust clinics with real photos",
      "After every appointment, send patients a link to leave a Google review",
      "Respond to every review — good or bad — within 24 hours",
    ],
    "Website not secure": [
      "Contact your web hosting company and ask them to install a free SSL certificate",
      "Most hosts (GoDaddy, Bluehost, SiteGround) offer free SSL — just ask support",
      "This changes your website from http:// to https:// which Google prefers",
    ],
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadSubmitting(true);
    try {
      await supabase.from("leads").insert({
        email: leadEmail,
        phone: leadPhone,
        url,
        city,
      });
      setLeadSuccess(true);
    } catch (err) {
      console.error("Lead save error:", err);
    }
    setLeadSubmitting(false);
  };

  useEffect(() => {
    if (!url) return;
    // Animate loading steps
    const steps = [0, 1, 2, 3];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < steps.length) setLoadingStep(i);
      else clearInterval(interval);
    }, 4000);
    fetch(
      `/api/audit?url=${encodeURIComponent(url)}&city=${encodeURIComponent(city)}`,
    )
      .then((res) => res.json())
      .then((d) => {
        if (d.error === "not_dental") {
          setError(d.message);
          setLoading(false);
          return;
        }
        setData(d);
        setLoading(false);
        // Fetch reviews for the SCANNED clinic
        if (url) {
          setReviewsLoading(true);
          fetch(
            `/api/reviews?url=${encodeURIComponent(url)}&city=${encodeURIComponent(city)}`,
          )
            .then((r) => r.json())
            .then((r) => {
              setReviews(r);
              setReviewsLoading(false);
            })
            .catch(() => setReviewsLoading(false));
        }
      })
      .catch(() => {
        setError("Failed to audit. Please try again.");
        setLoading(false);
      });
    return () => clearInterval(interval);
  }, [url, city]);

  const loadingSteps = [
    { icon: "⚡", label: "Checking website speed..." },
    { icon: "🔍", label: "Analyzing Google visibility..." },
    { icon: "🏆", label: "Finding competitors in " + city + "..." },
    { icon: "⭐", label: "Reading patient reviews..." },
  ];

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0D0F0E",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}
      >
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

        {/* Spinner */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "4px solid #2A3330",
            borderTopColor: "#1ABC9C",
            animation: "spin 1s linear infinite",
          }}
        />

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 26,
              color: "#F0EBE3",
              marginBottom: 8,
            }}
          >
            Scanning your clinic...
          </div>
          <div style={{ fontSize: 14, color: "#6B7B78" }}>{url}</div>
        </div>

        {/* Steps */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 320,
          }}
        >
          {loadingSteps.map((step, i) => {
            const isDone = i < loadingStep;
            const isActive = i === loadingStep;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 20px",
                  borderRadius: 12,
                  background: isDone
                    ? "rgba(46,204,113,0.08)"
                    : isActive
                      ? "rgba(26,188,156,0.08)"
                      : "#151918",
                  border: `1px solid ${isDone ? "rgba(46,204,113,0.2)" : isActive ? "rgba(26,188,156,0.2)" : "#2A3330"}`,
                  opacity: i > loadingStep ? 0.4 : 1,
                  transition: "all 0.4s ease",
                  animation: isActive ? "fadeIn 0.4s ease" : "none",
                }}
              >
                <div style={{ fontSize: 20 }}>{isDone ? "✅" : step.icon}</div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: isDone
                      ? "#2ECC71"
                      : isActive
                        ? "#F0EBE3"
                        : "#6B7B78",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {step.label}
                </div>
                {isActive && (
                  <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    {[0, 1, 2].map((j) => (
                      <div
                        key={j}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "#1ABC9C",
                          animation: "spin 1s linear infinite",
                          animationDelay: `${j * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

  if (error)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0D0F0E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 56 }}>🦷</div>
        <div
          style={{
            fontSize: 22,
            color: "#F0EBE3",
            fontFamily: "'Playfair Display', serif",
            maxWidth: 480,
          }}
        >
          {error}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "rgba(247,243,237,0.45)",
            maxWidth: 400,
          }}
        >
          RootCanal is built for dental clinics. Enter your clinic&apos;s
          website URL to get your free Google ranking report.
        </div>
        <a
          href="/"
          style={{
            background: "#1ABC9C",
            color: "#000",
            padding: "12px 28px",
            borderRadius: 8,
            fontWeight: 700,
            textDecoration: "none",
            fontSize: 14,
            marginTop: 8,
          }}
        >
          ← Enter Your Clinic URL
        </a>
      </div>
    );

  if (!data) return null;

  const gradeLabel =
    data.overallScore >= 80
      ? "🦷 Perfect Health"
      : data.overallScore >= 60
        ? "🦷 Minor Cavities"
        : data.overallScore >= 40
          ? "🦷 Needs Filling"
          : "🦷 Critical";
  const gradeColor =
    data.overallScore >= 70
      ? "#2ECC71"
      : data.overallScore >= 40
        ? "#F0A500"
        : "#E74C3C";
  const gradeBg =
    data.overallScore >= 70
      ? "rgba(46,204,113,0.12)"
      : data.overallScore >= 40
        ? "rgba(240,165,0,0.12)"
        : "rgba(231,76,60,0.12)";

  const failIssues = data.issues.filter((i) => i.status === "fail");
  const passIssues = data.issues.filter((i) => i.status === "pass");
  const warnIssues = data.issues.filter((i) => i.status === "warn");

  // Rank = position among competitors based on How Easy You Are to Find
  // We insert user into competitor list and find their position
  const userRank =
    data.competitors.length > 0
      ? (() => {
          const allScores = [
            ...data.competitors.map((c) => c.score),
            data.overallScore,
          ];
          allScores.sort((a, b) => b - a);
          const pos = allScores.indexOf(data.overallScore) + 1;
          return pos;
        })()
      : 1;

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#0D0F0E",
        minHeight: "100vh",
        color: "#F0EBE3",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0D0F0E; }
        ::-webkit-scrollbar-thumb { background: #2A3330; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .card { animation: fadeUp 0.5s ease both; }
        .nav-link { color: #6B7B78; text-decoration: none; font-size: 14px; font-weight: 500; }
        .nav-link:hover { color: #F0EBE3; }
        .upgrade-btn:hover { opacity: 0.85 !important; }
        .issue-row:hover { background: rgba(26,188,156,0.04) !important; }
        .comp-row:hover { background: rgba(255,255,255,0.02) !important; }
        @media print {
          body { background: #0D0F0E !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #F0EBE3 !important; }
          nav { position: static !important; }
          .card { animation: none !important; }
          button { display: none !important; }
          * { page-break-inside: avoid; }
          @page { margin: 20px; background: #0D0F0E; }
        }
        @media (max-width: 768px) {
          .rc-nav-url { display: none !important; }
          .rc-nav-export { display: none !important; }

          /* Score hero — stack vertically */
          .rc-score-hero { grid-template-columns: 1fr !important; }

          /* Metric cards — 2 col on tablet */
          .rc-metric-grid { grid-template-columns: repeat(2, 1fr) !important; }

          /* Hero review block — stack */
          .rc-hero-review { flex-direction: column !important; align-items: stretch !important; }
          .rc-hero-review > div:last-child { min-width: unset !important; width: 100% !important; }
          .rc-hero-review-row { flex-direction: column !important; }
          .rc-hero-review-row input { width: 100% !important; }
          .rc-hero-review-row button { width: 100% !important; }

          /* Competitor grid — 1 col */
          .rc-competitor-grid { grid-template-columns: 1fr !important; }

          /* Tabs — smaller text */
          .rc-tab-btn { font-size: 11px !important; padding: 8px 6px !important; }

          /* Main padding */
          .rc-main { padding: 16px !important; }
          nav { padding: 12px 16px !important; }

          /* Upgrade grid */
          .rc-upgrade-grid { grid-template-columns: 1fr !important; }
          .rc-upgrade-btns { flex-direction: column !important; align-items: stretch !important; }

          /* Gap analysis — stack */
          .rc-gap-grid { grid-template-columns: 1fr !important; }
          .rc-gap-vs { display: none !important; }

          /* Roadmap rows */
          .rc-roadmap-item { flex-wrap: wrap !important; }
        }
        @media (max-width: 480px) {
          /* Single col metrics on small phones */
          .rc-metric-grid { grid-template-columns: 1fr !important; }
          .rc-tab-btn { font-size: 10px !important; padding: 6px 3px !important; }
          h1 { font-size: 22px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav
        className="rc-nav-pad"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 40px",
          background: "rgba(13,15,14,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #2A3330",
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20,
            fontWeight: 900,
            color: "#F0EBE3",
            textDecoration: "none",
          }}
        >
          Root<span style={{ color: "#1ABC9C" }}>Canal</span>
        </a>
        <div
          className="rc-nav-url"
          style={{
            fontSize: 13,
            color: "#6B7B78",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {url} · {city}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => window.print()}
            className="rc-nav-export"
            style={{
              background: "transparent",
              color: "#6B7B78",
              border: "1px solid #2A3330",
              padding: "10px 16px",
              borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📄 Export PDF
          </button>
          <button
            className="upgrade-btn"
            onClick={handleUpgradeClick}
            style={{
              background: "#1ABC9C",
              color: "#000",
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            Upgrade to Pro — $49/mo
          </button>
        </div>
      </nav>

      <div className="rc-main-pad" style={{ padding: "32px 40px" }}>
        {/* HEADER */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: -1,
            }}
          >
            Your Dental Growth Report
          </h1>
          <p style={{ fontSize: 14, color: "#6B7B78", marginTop: 4 }}>
            Scanned {new Date(data.scannedAt).toLocaleString()} · {city}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "rgba(26,188,156,0.7)",
              marginTop: 4,
              fontStyle: "italic",
            }}
          >
            📡 Based on real-time Google visibility data in {city}
          </p>
        </div>

        {/* SCORE HERO — always visible at top */}
        {(() => (
          <div
            className="card rc-score-hero"
            style={{
              display: "grid",
              gridTemplateColumns: "260px 1fr",
              gap: 24,
              marginBottom: 24,
              animationDelay: "0.1s",
            }}
          >
            {/* Score ring */}
            <div
              style={{
                background: "#151918",
                border: "1px solid #2A3330",
                borderRadius: 16,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <ScoreRing score={data.overallScore} />
              <div
                style={{
                  marginTop: 16,
                  fontSize: 13,
                  fontWeight: 600,
                  color: gradeColor,
                  background: gradeBg,
                  padding: "4px 14px",
                  borderRadius: 20,
                }}
              >
                {gradeLabel}
              </div>
              <div style={{ fontSize: 13, color: "#6B7B78", marginTop: 8 }}>
                Your Google Score
              </div>
            </div>

            {/* Metrics */}
            <div
              className="rc-metric-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
              }}
            >
              {[
                {
                  icon: "🏆",
                  value: `#${userRank}`,
                  label: "Google Search Position",
                  sublabel: "Estimated — actual rank varies by location",
                  color:
                    typeof userRank === "number" && userRank <= 3
                      ? "#1ABC9C"
                      : "#E74C3C",
                  bg:
                    typeof userRank === "number" && userRank <= 3
                      ? "rgba(26,188,156,0.12)"
                      : "rgba(231,76,60,0.12)",
                },
                {
                  icon: "⚡",
                  value:
                    data.performanceScore === 0 && data.seoScore === 0
                      ? "—"
                      : data.performanceScore,
                  label: "Website Speed",
                  sublabel:
                    data.performanceScore < 60
                      ? "Slow site = patients leave before booking"
                      : "Fast site keeps patients engaged",
                  color:
                    data.performanceScore >= 70
                      ? "#2ECC71"
                      : data.performanceScore >= 40
                        ? "#F0A500"
                        : "#E74C3C",
                  bg:
                    data.performanceScore >= 70
                      ? "rgba(46,204,113,0.12)"
                      : "rgba(240,165,0,0.12)",
                },
                {
                  icon: "🔍",
                  value:
                    data.performanceScore === 0 && data.seoScore === 0
                      ? "—"
                      : data.seoScore,
                  label: "Google Findability",
                  sublabel:
                    data.seoScore < 60
                      ? "Low score = fewer calls from Google Maps"
                      : "Patients can find you easily on Google",
                  color:
                    data.seoScore >= 70
                      ? "#2ECC71"
                      : data.seoScore >= 40
                        ? "#F0A500"
                        : "#E74C3C",
                  bg:
                    data.seoScore >= 70
                      ? "rgba(46,204,113,0.12)"
                      : "rgba(240,165,0,0.12)",
                },
                {
                  icon: "👆",
                  value:
                    data.performanceScore === 0 && data.seoScore === 0
                      ? "—"
                      : data.accessibilityScore,
                  label: "Website Usability",
                  sublabel:
                    data.accessibilityScore < 70
                      ? "Hard to use = patients call competitors instead"
                      : "Easy to navigate = more appointment calls",
                  color: data.accessibilityScore >= 70 ? "#2ECC71" : "#F0A500",
                  bg: "rgba(240,165,0,0.12)",
                },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    background: "#151918",
                    border: "1px solid #2A3330",
                    borderRadius: 12,
                    padding: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: m.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    {m.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 32,
                        fontWeight: 900,
                        color: m.color,
                        lineHeight: 1,
                      }}
                    >
                      {m.value}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "#6B7B78", marginTop: 4 }}
                    >
                      {m.label}
                    </div>
                    {(m as any).sublabel && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(107,123,120,0.6)",
                          marginTop: 2,
                          fontStyle: "italic",
                        }}
                      >
                        {(m as any).sublabel}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Visibility banner — spans full width */}
              {data.competitors.length > 0 &&
                (() => {
                  const yourRankNum =
                    typeof userRank === "number" ? userRank : 8;
                  const inTopThree = yourRankNum <= 3;
                  return (
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        background: inTopThree
                          ? "rgba(46,204,113,0.08)"
                          : "rgba(231,76,60,0.08)",
                        border: `1px solid ${inTopThree ? "rgba(46,204,113,0.25)" : "rgba(231,76,60,0.25)"}`,
                        borderRadius: 12,
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <span style={{ fontSize: 24 }}>
                          {inTopThree ? "🏆" : "📉"}
                        </span>
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#F0EBE3",
                            }}
                          >
                            {inTopThree
                              ? `You're in the top 3 in ${city}!`
                              : `You're outside the top 3 — most patients never scroll that far`}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6B7B78",
                              marginTop: 2,
                            }}
                          >
                            {inTopThree
                              ? "Top 3 clinics receive ~70% of all patient clicks on Google."
                              : "Top 3 clinics receive ~70% of clicks. Most patients never see you."}
                          </div>
                        </div>
                      </div>
                      {!inTopThree && (
                        <button
                          onClick={handleUpgradeClick}
                          style={{
                            background: "#E74C3C",
                            color: "#fff",
                            border: "none",
                            padding: "10px 20px",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "'DM Sans', sans-serif",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          Get Into Top 3 →
                        </button>
                      )}
                    </div>
                  );
                })()}
            </div>
          </div>
        ))()}

        {/* UPGRADE BANNER */}
        {data.overallScore < 70 && (
          <div
            className="card"
            style={{
              background: "linear-gradient(135deg, #1a2f2a, #0f1f1b)",
              border: "1px solid rgba(26,188,156,0.3)",
              borderRadius: 16,
              padding: "24px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
              position: "relative",
              overflow: "hidden",
              animationDelay: "0.2s",
            }}
          >
            <div
              style={{
                position: "absolute",
                fontSize: 120,
                right: -10,
                top: -20,
                opacity: 0.06,
                pointerEvents: "none",
              }}
            >
              🦷
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                🚨 Your score is {data.overallScore}/100 — competitors are
                beating you
              </div>
              <div style={{ fontSize: 14, color: "#6B7B78" }}>
                Upgrade to Pro for monthly rescans, full fix guides, competitor
                tracking and review automation.
              </div>
            </div>
            <button
              className="upgrade-btn no-print"
              onClick={handleUpgradeClick}
              style={{
                background: "#1ABC9C",
                color: "#000",
                border: "none",
                padding: "12px 28px",
                borderRadius: 8,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "opacity 0.2s",
              }}
            >
              Upgrade to Pro — $49/mo →
            </button>
          </div>
        )}

        {/* ── HERO REVIEW BLOCK ── */}
        <div
          className="card no-print rc-hero-review"
          style={{
            background: "linear-gradient(135deg, #0f2a20, #0D1F18)",
            border: "1px solid rgba(26,188,156,0.4)",
            borderRadius: 16,
            padding: 28,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: "#1ABC9C",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              ⭐ Biggest Growth Lever
            </div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 22,
                fontWeight: 800,
                color: "#F0EBE3",
                marginBottom: 6,
              }}
            >
              Get More Reviews This Week
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(247,243,237,0.5)",
                lineHeight: 1.6,
              }}
            >
              More Google reviews = higher ranking = more patient bookings.
              <br />
              Send a direct review link to a recent patient in 2 seconds.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minWidth: 280,
            }}
          >
            <div
              className="rc-hero-review-input"
              style={{ display: "flex", gap: 10 }}
            >
              <input
                type="text"
                value={reviewContact}
                onChange={(e) => {
                  setReviewContact(e.target.value);
                  setReviewError("");
                }}
                placeholder="patient@email.com"
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(26,188,156,0.3)",
                  borderRadius: 8,
                  padding: "12px 16px",
                  color: "#F0EBE3",
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                  outline: "none",
                }}
              />
              <button
                onClick={async () => {
                  if (!reviewContact.trim() || !data.placeId) return;
                  setReviewSending(true);
                  setReviewError("");
                  const isEmail = reviewContact.includes("@");
                  try {
                    const res = await fetch("/api/request-review", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        contact: reviewContact.trim(),
                        type: isEmail ? "email" : "phone",
                        clinicName: data.url
                          .replace(/https?:\/\//, "")
                          .replace(/www\./, "")
                          .split("/")[0],
                        clinicUrl: data.url,
                        placeId: data.placeId,
                      }),
                    });
                    const result = await res.json();
                    if (result.success) {
                      setReviewSent(true);
                      setReviewContact("");
                    } else setReviewError("Failed to send. Please try again.");
                  } catch {
                    setReviewError("Something went wrong.");
                  } finally {
                    setReviewSending(false);
                  }
                }}
                disabled={
                  reviewSending || !reviewContact.trim() || !data.placeId
                }
                style={{
                  background:
                    reviewContact.trim() && data.placeId
                      ? "#1ABC9C"
                      : "#1A2320",
                  color:
                    reviewContact.trim() && data.placeId ? "#000" : "#6B7B78",
                  border: "none",
                  padding: "12px 20px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {reviewSending ? "Sending..." : "Send ⭐ Request →"}
              </button>
            </div>
            {reviewSent && (
              <div style={{ fontSize: 12, color: "#2ECC71" }}>
                🎉 Review request sent! Your patient will receive a direct
                Google review link.
              </div>
            )}
            {reviewError && (
              <div style={{ fontSize: 12, color: "#E74C3C" }}>
                {reviewError}
              </div>
            )}
            {!data.placeId && (
              <div style={{ fontSize: 12, color: "#F0A500" }}>
                ⚠️ Set up your Google Business Profile first to enable review
                requests.
              </div>
            )}
          </div>
        </div>

        {/* ── TOP 3 PRIORITIES ── */}
        {(() => {
          const priorities: string[] = [];
          const reviewCount = reviews?.total ?? 0;
          const topReviews =
            data.competitors.length > 0
              ? Math.max(...data.competitors.map((c) => c.reviews ?? 0))
              : 0;
          const reviewGap = Math.max(0, topReviews - reviewCount);
          if (reviewGap > 0)
            priorities.push(
              `Get ${Math.min(reviewGap, 20)} more Google reviews to close the gap with top competitors`,
            );
          if (data.performanceScore > 0 && data.performanceScore < 60)
            priorities.push(
              `Speed up your website — it loads at ${data.performanceScore}/100, which is hurting your ranking`,
            );
          if (reviews && reviews.responseRate < 70)
            priorities.push(
              `Respond to recent patient reviews — top clinics respond to 70%+ of reviews`,
            );
          if (data.seoScore > 0 && data.seoScore < 70)
            priorities.push(
              `Improve your Google findability score — currently ${data.seoScore}/100`,
            );
          const top3 = priorities.slice(0, 3);
          if (top3.length === 0) return null;
          return (
            <div
              className="card"
              style={{
                background: "#151918",
                border: "1px solid #2A3330",
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 16,
                  color: "#F0EBE3",
                }}
              >
                📋 Your Focus This Month
              </div>
              {top3.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    padding: "12px 0",
                    borderBottom:
                      i < top3.length - 1 ? "1px solid #1A2320" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background:
                        i === 0 ? "#C0392B" : i === 1 ? "#D4A843" : "#2A3330",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#fff",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "rgba(247,243,237,0.8)",
                      lineHeight: 1.6,
                    }}
                  >
                    {p}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── TAB NAV ── */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 24,
            background: "#151918",
            borderRadius: 12,
            padding: 4,
            border: "1px solid #2A3330",
            overflowX: "auto",
          }}
        >
          {(
            [
              { id: "competitors", label: "🏆 Competitors" },
              { id: "roadmap", label: "🗺️ Growth Plan" },
              { id: "reviews", label: "⭐ Reviews" },
              { id: "score", label: "🧠 Intelligence" },
              { id: "health", label: "🔧 Health" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="rc-tab-btn"
              style={{
                flex: 1,
                padding: "10px 16px",
                border: "none",
                cursor: "pointer",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                background: activeTab === tab.id ? "#1ABC9C" : "transparent",
                color: activeTab === tab.id ? "#000" : "#6B7B78",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* COMPETITORS TAB CONTENT */}
        {activeTab === "competitors" && (
          <>
            {data.competitors.length > 0 && (
              <>
                {/* ── COMPETITOR GAP CARD ── */}
                {reviews &&
                  data.competitors.length > 0 &&
                  (() => {
                    const topComp = [...data.competitors].sort(
                      (a, b) => b.score - a.score,
                    )[0];
                    const ratingGap = (
                      (topComp.rating || 0) - (reviews.rating || 0)
                    ).toFixed(1);
                    const reviewGap =
                      (topComp.reviews || 0) - (reviews.total || 0);
                    return (
                      <div
                        className="card"
                        style={{
                          background: "#151918",
                          border: "1px solid #2A3330",
                          borderRadius: 16,
                          padding: 24,
                          marginBottom: 24,
                          animationDelay: "0.35s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 20,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "'Playfair Display', serif",
                              fontSize: 18,
                              fontWeight: 700,
                            }}
                          >
                            You vs. Top Competitor
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "4px 12px",
                              borderRadius: 20,
                              background: "rgba(231,76,60,0.1)",
                              color: "#E74C3C",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            GAP ANALYSIS
                          </span>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto 1fr",
                            gap: 16,
                            alignItems: "center",
                          }}
                        >
                          {/* Your stats */}
                          <div
                            style={{
                              background: "rgba(26,188,156,0.06)",
                              border: "1px solid rgba(26,188,156,0.2)",
                              borderRadius: 12,
                              padding: 16,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: "#6B7B78",
                                fontWeight: 600,
                                marginBottom: 12,
                                textTransform: "uppercase",
                                letterSpacing: 1,
                              }}
                            >
                              Your Clinic
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: 22,
                                    fontWeight: 900,
                                    color: "#1ABC9C",
                                    fontFamily: "'Playfair Display', serif",
                                  }}
                                >
                                  {reviews.rating?.toFixed(1) ?? "—"} ⭐
                                </div>
                                <div style={{ fontSize: 11, color: "#6B7B78" }}>
                                  Google Rating
                                </div>
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontSize: 22,
                                    fontWeight: 900,
                                    color: "#1ABC9C",
                                    fontFamily: "'Playfair Display', serif",
                                  }}
                                >
                                  {reviews.total ?? "—"}
                                </div>
                                <div style={{ fontSize: 11, color: "#6B7B78" }}>
                                  Reviews
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* VS divider */}
                          <div style={{ textAlign: "center" }}>
                            <div
                              style={{
                                fontSize: 16,
                                fontWeight: 900,
                                color: "#2A3330",
                              }}
                            >
                              VS
                            </div>
                          </div>
                          {/* Top competitor stats */}
                          <div
                            style={{
                              background: "rgba(231,76,60,0.06)",
                              border: "1px solid rgba(231,76,60,0.2)",
                              borderRadius: 12,
                              padding: 16,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: "#6B7B78",
                                fontWeight: 600,
                                marginBottom: 12,
                                textTransform: "uppercase",
                                letterSpacing: 1,
                              }}
                            >
                              Top Clinic
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: 22,
                                    fontWeight: 900,
                                    color: "#E74C3C",
                                    fontFamily: "'Playfair Display', serif",
                                  }}
                                >
                                  {(topComp.rating || 0).toFixed(1)} ⭐
                                </div>
                                <div style={{ fontSize: 11, color: "#6B7B78" }}>
                                  Google Rating{" "}
                                  {Number(ratingGap) > 0 ? (
                                    <span style={{ color: "#E74C3C" }}>
                                      ({ratingGap} ahead)
                                    </span>
                                  ) : (
                                    <span style={{ color: "#2ECC71" }}>
                                      ✓ You lead
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontSize: 22,
                                    fontWeight: 900,
                                    color: "#E74C3C",
                                    fontFamily: "'Playfair Display', serif",
                                  }}
                                >
                                  {topComp.reviews || "—"}
                                </div>
                                <div style={{ fontSize: 11, color: "#6B7B78" }}>
                                  Reviews{" "}
                                  {reviewGap > 0 ? (
                                    <span style={{ color: "#E74C3C" }}>
                                      ({reviewGap} more)
                                    </span>
                                  ) : (
                                    <span style={{ color: "#2ECC71" }}>
                                      ✓ You lead
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </>
            )}
          </>
        )}

        {/* ROADMAP TAB */}
        {activeTab === "roadmap" && (
          <div
            className="card"
            style={{
              background: "#151918",
              border: "1px solid #2A3330",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              animationDelay: "0.4s",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                Your Growth Roadmap 🗺️
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: "rgba(240,165,0,0.12)",
                  color: "#F0A500",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                You are #{userRank}
              </span>
            </div>

            {/* You are here */}
            <div
              style={{
                background: "rgba(26,188,156,0.06)",
                border: "1px solid rgba(26,188,156,0.3)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 20 }}>📍</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "#1ABC9C",
                    fontWeight: 700,
                    marginBottom: 2,
                  }}
                >
                  YOU ARE HERE
                </div>
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: "#F0EBE3" }}
                >
                  {(() => {
                    try {
                      return new URL(url).hostname.replace("www.", "");
                    } catch {
                      return url || "your clinic";
                    }
                  })()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#1ABC9C",
                  }}
                >
                  #{userRank}
                </div>
                <div style={{ fontSize: 11, color: "#6B7B78" }}>
                  Local Rank (est.)
                </div>
              </div>
            </div>

            {/* Closest competitors to overtake */}
            {(() => {
              // Get competitors ahead of user, sorted by closest score first
              const aheadComps = data.competitors
                .filter((c) => c.score > data.overallScore)
                .sort((a, b) => a.score - b.score)
                .slice(0, 3);

              // Get competitors behind user
              const behindComps = data.competitors
                .filter((c) => c.score < data.overallScore + 5)
                .sort((a, b) => b.score - a.score)
                .slice(0, 2);

              const stepsToShow = [...aheadComps].slice(0, 3);

              return (
                <div>
                  {stepsToShow.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "24px 0",
                        color: "#1ABC9C",
                        fontSize: 15,
                        fontWeight: 600,
                      }}
                    >
                      🏆 You are already leading! Keep it up.
                    </div>
                  )}

                  {stepsToShow.map((comp, i) => {
                    const gap = comp.score - data.overallScore;
                    const reviewGap =
                      (comp.reviews || 0) - (reviews?.total || 0);
                    const weeks =
                      i === 0
                        ? "3–4 weeks"
                        : i === 1
                          ? "6–8 weeks"
                          : "3–4 months";
                    const isLocked = i > 0;

                    return (
                      <div
                        key={i}
                        style={{
                          position: "relative",
                          marginBottom: 12,
                          opacity: isLocked ? 0.6 : 1,
                        }}
                      >
                        {/* Connector line */}
                        {i < stepsToShow.length - 1 && (
                          <div
                            style={{
                              position: "absolute",
                              left: 20,
                              top: "100%",
                              width: 2,
                              height: 12,
                              background: "#2A3330",
                              zIndex: 0,
                            }}
                          />
                        )}

                        <div
                          style={{
                            background: isLocked
                              ? "#0D0F0E"
                              : "rgba(240,165,0,0.04)",
                            border: `1px solid ${isLocked ? "#2A3330" : "rgba(240,165,0,0.2)"}`,
                            borderRadius: 12,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: isLocked
                                ? "#1A1F1E"
                                : "rgba(240,165,0,0.12)",
                              border: `2px solid ${isLocked ? "#2A3330" : "#F0A500"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              flexShrink: 0,
                            }}
                          >
                            {isLocked ? "🔒" : `${i + 1}`}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: isLocked ? "#6B7B78" : "#F0EBE3",
                                }}
                              >
                                Step {i + 1}: Overtake{" "}
                                {(comp.name || "Competitor").length > 25
                                  ? (comp.name || "Competitor").slice(0, 25) +
                                    "..."
                                  : comp.name || "Competitor"}
                              </div>
                              {!isLocked && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    background: "rgba(240,165,0,0.12)",
                                    color: "#F0A500",
                                    fontFamily: "'DM Mono', monospace",
                                  }}
                                >
                                  NEXT TARGET
                                </span>
                              )}
                            </div>

                            {!isLocked ? (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#6B7B78",
                                  lineHeight: 1.6,
                                }}
                              >
                                {reviewGap > 0
                                  ? `Get ${reviewGap} more reviews + improve score by ${gap} points`
                                  : `Improve your score by ${gap} points`}{" "}
                                — estimated{" "}
                                <span
                                  style={{ color: "#F0A500", fontWeight: 600 }}
                                >
                                  {weeks}
                                </span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: "#6B7B78" }}>
                                🔒 Unlock with Pro to see full roadmap
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 16,
                                fontWeight: 700,
                                color: isLocked ? "#6B7B78" : "#F0A500",
                              }}
                            >
                              Score: {comp.score}
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7B78" }}>
                              {gap > 0 ? `+${gap} ahead` : "same level"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Final goal */}
                  {stepsToShow.length > 0 && (
                    <div
                      style={{
                        background: "rgba(46,204,113,0.04)",
                        border: "1px solid rgba(46,204,113,0.15)",
                        borderRadius: 12,
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginTop: 12,
                        opacity: 0.5,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "rgba(46,204,113,0.1)",
                          border: "2px solid #2ECC71",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        🏆
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#2ECC71",
                            marginBottom: 4,
                          }}
                        >
                          Final Goal:{" "}
                          {(typeof userRank === "number" ? userRank : 8) <= 3
                            ? `Rank #1 in ${city}`
                            : `Top 3 in ${city}`}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7B78" }}>
                          🔒 Get Pro to unlock your full step-by-step growth
                          plan
                        </div>
                      </div>
                      <button
                        onClick={handleUpgradeClick}
                        style={{
                          background: "#2ECC71",
                          color: "#000",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                          flexShrink: 0,
                        }}
                      >
                        Get Pro →
                      </button>
                    </div>
                  )}

                  {/* Clinics behind you */}
                  {behindComps.length > 0 && (
                    <div
                      style={{
                        marginTop: 20,
                        paddingTop: 16,
                        borderTop: "1px solid #2A3330",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6B7B78",
                          fontWeight: 600,
                          marginBottom: 10,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        Clinics Behind You — Don&apos;t Let Them Catch Up!
                      </div>
                      {behindComps.map((comp, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 0",
                            borderBottom: "1px solid #1A1F1E",
                          }}
                        >
                          <span style={{ fontSize: 14 }}>👇</span>
                          <div
                            style={{ flex: 1, fontSize: 13, color: "#6B7B78" }}
                          >
                            {comp.name}
                          </div>
                          <div
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 13,
                              color: "#6B7B78",
                            }}
                          >
                            Score: {comp.score}{" "}
                            <span
                              style={{
                                color:
                                  data.overallScore - comp.score === 0
                                    ? "#F0A500"
                                    : "#2ECC71",
                                marginLeft: 4,
                              }}
                            >
                              {data.overallScore - comp.score === 0
                                ? "⚠️ Tied!"
                                : `(${data.overallScore - comp.score} behind)`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <div
            className="card"
            style={{
              background: "#151918",
              border: "1px solid #2A3330",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              animationDelay: "0.5s",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                ⭐ What Patients Are Saying About You
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: "rgba(26,188,156,0.12)",
                  color: "#1ABC9C",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                AI Powered
              </span>
            </div>

            {reviewsLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "#6B7B78",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 12 }}>🔍</div>
                Analyzing patient reviews...
              </div>
            ) : !reviews || (!reviews.analysis && reviews.total === 0) ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 24px",
                  background: "rgba(240,165,0,0.05)",
                  border: "1px solid rgba(240,165,0,0.15)",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 16 }}>⭐</div>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#F0EBE3",
                    marginBottom: 10,
                  }}
                >
                  No Google reviews found for your clinic
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "#6B7B78",
                    lineHeight: 1.7,
                    maxWidth: 420,
                    marginTop: 0,
                    marginBottom: 20,
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                >
                  Clinics with more reviews rank higher on Google and attract
                  more patients. In fact,{" "}
                  <span style={{ color: "#F0A500", fontWeight: 600 }}>
                    85% of patients
                  </span>{" "}
                  read Google reviews before choosing a dentist.
                </div>
                <div
                  style={{ fontSize: 13, color: "#6B7B78", marginBottom: 24 }}
                >
                  With Pro, we automatically ask your patients for reviews after
                  every visit — so your clinic builds trust while you focus on
                  care.
                </div>
                <button
                  onClick={handleUpgradeClick}
                  style={{
                    background: "#F0A500",
                    color: "#000",
                    border: "none",
                    padding: "12px 28px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Get More Reviews with Pro →
                </button>
              </div>
            ) : reviews?.analysis ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                }}
              >
                {/* Summary + Sentiment Breakdown */}
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {/* Summary */}
                  <div
                    style={{
                      background: "#0D0F0E",
                      borderRadius: 12,
                      padding: 20,
                      borderLeft: "4px solid #1ABC9C",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        color: "#1ABC9C",
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      OVERALL IMPRESSION
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        color: "#F0EBE3",
                        lineHeight: 1.6,
                      }}
                    >
                      {reviews.analysis.summary}
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        marginTop: 12,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 12px",
                        borderRadius: 20,
                        background:
                          reviews.analysis.sentiment === "positive"
                            ? "rgba(46,204,113,0.12)"
                            : reviews.analysis.sentiment === "negative"
                              ? "rgba(231,76,60,0.12)"
                              : "rgba(240,165,0,0.12)",
                        color:
                          reviews.analysis.sentiment === "positive"
                            ? "#2ECC71"
                            : reviews.analysis.sentiment === "negative"
                              ? "#E74C3C"
                              : "#F0A500",
                      }}
                    >
                      {reviews.analysis.sentiment?.toUpperCase()}
                    </div>
                  </div>

                  {/* Sentiment Breakdown */}
                  <div
                    style={{
                      background: "#0D0F0E",
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6B7B78",
                        fontWeight: 600,
                        marginBottom: 16,
                      }}
                    >
                      HOW PATIENTS FEEL
                    </div>
                    {[
                      {
                        label: "Positive",
                        pct: reviews.sentimentBreakdown?.positive ?? 0,
                        color: "#2ECC71",
                      },
                      {
                        label: "Neutral",
                        pct: reviews.sentimentBreakdown?.neutral ?? 0,
                        color: "#F0A500",
                      },
                      {
                        label: "Negative",
                        pct: reviews.sentimentBreakdown?.negative ?? 0,
                        color: "#E74C3C",
                      },
                    ].map(({ label, pct, color }) => (
                      <div key={label} style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: 13, color: "#F0EBE3" }}>
                            {label}
                          </span>
                          <span
                            style={{ fontSize: 13, color, fontWeight: 700 }}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "#2A3330",
                            borderRadius: 3,
                          }}
                        >
                          <div
                            style={{
                              height: 6,
                              background: color,
                              borderRadius: 3,
                              width: `${pct}%`,
                              transition: "width 1s ease",
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Review count comparison */}
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: "1px solid #2A3330",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color: "#6B7B78",
                          fontWeight: 600,
                          marginBottom: 8,
                        }}
                      >
                        REVIEW COUNT
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ textAlign: "center" }}>
                          <div
                            style={{
                              fontFamily: "'Playfair Display', serif",
                              fontSize: 28,
                              fontWeight: 900,
                              color: "#F0A500",
                            }}
                          >
                            {reviews.total}
                          </div>
                          <div style={{ fontSize: 11, color: "#6B7B78" }}>
                            Your reviews
                          </div>
                        </div>
                        <div style={{ fontSize: 20, color: "#2A3330" }}>vs</div>
                        <div style={{ textAlign: "center" }}>
                          <div
                            style={{
                              fontFamily: "'Playfair Display', serif",
                              fontSize: 28,
                              fontWeight: 900,
                              color: "#2ECC71",
                            }}
                          >
                            {Math.max(
                              ...data.competitors.map((c) => c.reviews || 0),
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#6B7B78" }}>
                            Top clinic
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Response Rate */}
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: "#0D0F0E",
                    borderRadius: 12,
                    padding: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6B7B78",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      REVIEW YOU REPLY TO REVIEWS
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#F0EBE3",
                        lineHeight: 1.6,
                      }}
                    >
                      You respond to{" "}
                      <strong
                        style={{
                          color:
                            (reviews.responseRate ?? 0) < 50
                              ? "#E74C3C"
                              : "#2ECC71",
                        }}
                      >
                        {reviews.responseRate ?? 0}%
                      </strong>{" "}
                      of patient reviews. Top clinics respond to{" "}
                      <strong style={{ color: "#2ECC71" }}>70%+</strong> —
                      responding improves trust and Google ranking.
                    </div>
                  </div>
                  {(reviews.responseRate ?? 0) < 50 && (
                    <div
                      style={{
                        background: "rgba(231,76,60,0.1)",
                        border: "1px solid rgba(231,76,60,0.2)",
                        borderRadius: 8,
                        padding: "8px 16px",
                        fontSize: 13,
                        color: "#E74C3C",
                        fontWeight: 600,
                      }}
                    >
                      ⚠️ Respond to more reviews!
                    </div>
                  )}
                </div>

                {/* What patients love */}
                <div
                  style={{
                    background: "#0D0F0E",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "#2ECC71",
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    💚 What Patients Love About You
                  </div>
                  {reviews.analysis.loves?.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 13,
                        color: "#F0EBE3",
                        marginBottom: 8,
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span style={{ color: "#2ECC71" }}>✓</span> {item}
                    </div>
                  ))}
                </div>

                {/* Complaints */}
                <div
                  style={{
                    background: "#0D0F0E",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "#E74C3C",
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    🚨 What Patients Complain About
                  </div>
                  {reviews.analysis.complaints?.length > 0 ? (
                    reviews.analysis.complaints.map(
                      (item: string, i: number) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 13,
                            color: "#F0EBE3",
                            marginBottom: 8,
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <span style={{ color: "#E74C3C" }}>✗</span> {item}
                        </div>
                      ),
                    )
                  ) : (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#2ECC71",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>🎉</span>
                      <span>
                        No significant complaints found — your patients are
                        happy!
                      </span>
                    </div>
                  )}
                </div>

                {/* Fix now */}
                <div
                  style={{
                    background: "#0D0F0E",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "#F0A500",
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    ⚡ What You Should Fix
                  </div>
                  {reviews.analysis.fixNow?.length > 0 ? (
                    reviews.analysis.fixNow.map((item: string, i: number) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 13,
                          color: "#F0EBE3",
                          marginBottom: 8,
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <span style={{ color: "#F0A500" }}>→</span> {item}
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#2ECC71",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>✅</span>
                      <span>
                        Nothing urgent — focus on getting more reviews to stay
                        ahead!
                      </span>
                    </div>
                  )}
                </div>

                {/* Promote */}
                <div
                  style={{
                    background: "#0D0F0E",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "#1ABC9C",
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    📈 What You Should Promote
                  </div>
                  {reviews.analysis.promote?.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 13,
                        color: "#F0EBE3",
                        marginBottom: 8,
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span style={{ color: "#1ABC9C" }}>→</span> {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "#6B7B78",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 12 }}>⭐</div>
                No review data available for this clinic
              </div>
            )}
          </div>
        )}

        {/* HEALTH TAB */}

        {/* SCORE TAB */}
        {activeTab === "score" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Score breakdown cards */}
            <div
              className="card"
              style={{
                background: "#151918",
                border: "1px solid #2A3330",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 20,
                }}
              >
                📊 Your Score Breakdown
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                {[
                  {
                    label: "Website Speed",
                    value:
                      data.performanceScore === 0 && data.seoScore === 0
                        ? null
                        : data.performanceScore,
                    desc: "How fast your site loads for patients",
                    icon: "⚡",
                  },
                  {
                    label: "Google Findability",
                    value:
                      data.performanceScore === 0 && data.seoScore === 0
                        ? null
                        : data.seoScore,
                    desc: "How easily Google can find your clinic",
                    icon: "🔍",
                  },
                  {
                    label: "Website Usability",
                    value:
                      data.performanceScore === 0 && data.seoScore === 0
                        ? null
                        : data.accessibilityScore,
                    desc: "How easy your site is for patients to use",
                    icon: "👆",
                  },
                  {
                    label: "Overall Score",
                    value: data.overallScore,
                    desc: "Your combined Google presence score",
                    icon: "🏆",
                  },
                ].map((item, i) => {
                  const val = item.value;
                  const color =
                    val === null
                      ? "#6B7B78"
                      : val >= 70
                        ? "#2ECC71"
                        : val >= 40
                          ? "#F0A500"
                          : "#E74C3C";
                  return (
                    <div
                      key={i}
                      style={{
                        background: "#0D0F0E",
                        borderRadius: 12,
                        padding: 20,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{item.icon}</span>
                        <span
                          style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: 32,
                            fontWeight: 900,
                            color,
                          }}
                        >
                          {val === null ? "—" : val}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#F0EBE3",
                          marginBottom: 4,
                        }}
                      >
                        {item.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7B78" }}>
                        {item.desc}
                      </div>
                      {val !== null && (
                        <div
                          style={{
                            marginTop: 12,
                            height: 4,
                            background: "#1A2320",
                            borderRadius: 2,
                          }}
                        >
                          <div
                            style={{
                              height: 4,
                              width: `${val}%`,
                              background: color,
                              borderRadius: 2,
                              transition: "width 1s ease",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* What your score means */}
            <div
              className="card"
              style={{
                background: "#151918",
                border: "1px solid #2A3330",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                What Your Score Means
              </div>
              {[
                {
                  range: "80–100",
                  label: "Top Performer",
                  desc: "You're ahead of most clinics. Focus on reviews and maintaining your position.",
                  color: "#2ECC71",
                },
                {
                  range: "60–79",
                  label: "Good Standing",
                  desc: "Solid foundation. A few targeted fixes can push you into the top 3.",
                  color: "#F0A500",
                },
                {
                  range: "40–59",
                  label: "Needs Work",
                  desc: "Competitors are likely outranking you. Address the issues in the Health tab.",
                  color: "#E67E22",
                },
                {
                  range: "0–39",
                  label: "Critical",
                  desc: "Patients searching Google can barely find you. Immediate action needed.",
                  color: "#E74C3C",
                },
              ].map((tier, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "12px 0",
                    borderBottom: i < 3 ? "1px solid #1A2320" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      textAlign: "center",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: tier.color,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {tier.range}
                  </div>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: tier.color,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color:
                          data.overallScore >= parseInt(tier.range)
                            ? tier.color
                            : "#F0EBE3",
                      }}
                    >
                      {tier.label}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#6B7B78", marginTop: 2 }}
                    >
                      {tier.desc}
                    </div>
                  </div>
                  {data.overallScore >= parseInt(tier.range.split("–")[0]) &&
                    data.overallScore <= parseInt(tier.range.split("–")[1]) && (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 11,
                          fontWeight: 700,
                          color: tier.color,
                          background: `${tier.color}18`,
                          padding: "3px 10px",
                          borderRadius: 20,
                          flexShrink: 0,
                        }}
                      >
                        YOU ARE HERE
                      </span>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "health" && (
          <>
            {/* ISSUES */}
            <div
              className="card"
              style={{
                marginBottom: 24,
                animationDelay: "0.3s",
              }}
            >
              {/* Unified Checklist */}
              <div
                style={{
                  background: "#151918",
                  border: "1px solid #2A3330",
                  borderRadius: 16,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    Your Clinic Health Checklist
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: 20,
                        background: "rgba(231,76,60,0.12)",
                        color: "#E74C3C",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {failIssues.length} Failed
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: 20,
                        background: "rgba(240,165,0,0.12)",
                        color: "#F0A500",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {warnIssues.length} Warning
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: 20,
                        background: "rgba(46,204,113,0.12)",
                        color: "#2ECC71",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {passIssues.length} Good
                    </span>
                  </div>
                </div>
                {[...failIssues, ...warnIssues, ...passIssues].map(
                  (issue, i) => {
                    const icon =
                      issue.status === "fail"
                        ? "❌"
                        : issue.status === "warn"
                          ? "⚠️"
                          : "✅";
                    const dotColor =
                      issue.status === "fail"
                        ? "#E74C3C"
                        : issue.status === "warn"
                          ? "#F0A500"
                          : "#2ECC71";
                    const isExpanded = expandedIssue === i;
                    return (
                      <div
                        key={i}
                        className="issue-row"
                        style={{
                          padding: "14px 0",
                          borderBottom: "1px solid #2A3330",
                          borderRadius: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 14,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 18,
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            {icon}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                marginBottom: 4,
                                color:
                                  issue.status === "pass"
                                    ? "#A0B0AD"
                                    : "#F0EBE3",
                              }}
                            >
                              {issue.title}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6B7B78",
                                lineHeight: 1.5,
                              }}
                            >
                              {issue.desc}
                            </div>
                            {fixGuides[issue.title] && (
                              <button
                                onClick={() =>
                                  setExpandedIssue(isExpanded ? null : i)
                                }
                                style={{
                                  marginTop: 8,
                                  background: "transparent",
                                  border: `1px solid ${dotColor}40`,
                                  color: dotColor,
                                  padding: "4px 12px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                {isExpanded
                                  ? "▲ Hide fix guide"
                                  : "▼ How to fix this"}
                              </button>
                            )}
                            {isExpanded && fixGuides[issue.title] && (
                              <div
                                style={{
                                  marginTop: 12,
                                  background: "#0D0F0E",
                                  borderRadius: 8,
                                  padding: 16,
                                  borderLeft: `3px solid ${dotColor}`,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#1ABC9C",
                                    fontWeight: 600,
                                    marginBottom: 10,
                                  }}
                                >
                                  🛠️ HOW TO FIX THIS
                                </div>
                                {fixGuides[issue.title].map((step, j) => (
                                  <div
                                    key={j}
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      fontSize: 12,
                                      color: "#F0EBE3",
                                      marginBottom: 8,
                                      lineHeight: 1.6,
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "#1ABC9C",
                                        fontWeight: 700,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {j + 1}.
                                    </span>
                                    {step}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {issue.status !== "pass" && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 4,
                                background:
                                  issue.priority === "HIGH"
                                    ? "rgba(231,76,60,0.12)"
                                    : "rgba(240,165,0,0.12)",
                                color:
                                  issue.priority === "HIGH"
                                    ? "#E74C3C"
                                    : "#F0A500",
                                fontFamily: "'DM Mono', monospace",
                                flexShrink: 0,
                              }}
                            >
                              {issue.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}

                {/* Google Profile Checklist */}
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 20,
                    borderTop: "1px solid #2A3330",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      marginBottom: 16,
                      color: "#F0A500",
                    }}
                  >
                    ⚡ Easy Wins — Do These This Week
                  </div>
                  {[
                    "Add 'dentist + your city' to your homepage title",
                    "Complete your Google Business Profile",
                    "Ask your last 10 patients for a Google review",
                    "Add your clinic hours to Google",
                    "Upload 10+ photos to Google Business",
                  ].map((tip, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        padding: "8px 0",
                        fontSize: 13,
                        color: "#6B7B78",
                      }}
                    >
                      <span
                        style={{
                          color: "#1ABC9C",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        →
                      </span>
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* BOTTOM CTA */}
        <div
          className="card"
          style={{
            background: "linear-gradient(135deg, #1a2f2a, #0f1f1b)",
            border: "1px solid rgba(26,188,156,0.3)",
            borderRadius: 16,
            padding: 40,
            textAlign: "center",
            animationDelay: "0.5s",
          }}
        >
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28,
              fontWeight: 900,
              marginBottom: 12,
            }}
          >
            Don't lose patients to nearby competitors.
          </div>
          <div
            style={{
              fontSize: 15,
              color: "#6B7B78",
              marginBottom: 32,
              maxWidth: 560,
              margin: "0 auto 32px",
            }}
          >
            Stay ahead of nearby clinics and keep attracting new patients.
            Monitor reviews, rankings and competitor moves every month — so
            you're always one step ahead.
          </div>
          <div
            style={{
              fontSize: 15,
              color: "#A0B0AD",
              maxWidth: 560,
              marginTop: 0,
              marginBottom: 32,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Unlock competitor tracking, monthly growth insights, and review
            automation — everything you need to reach and hold the #1 spot in
            your city.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              maxWidth: 640,
              margin: "0 auto 32px",
              textAlign: "left",
            }}
          >
            {[
              {
                icon: "⭐",
                title: "Get More Reviews",
                desc: "We automatically ask your patients for Google reviews after every visit",
              },
              {
                icon: "📈",
                title: "Monthly Progress",
                desc: "See if your score improves each month and what changed",
              },
              {
                icon: "🔔",
                title: "Competitor Alerts",
                desc: "Get notified the moment a competitor overtakes your ranking",
              },
              {
                icon: "💬",
                title: "Review Monitoring",
                desc: "Instant alerts when a patient leaves a new review — good or bad",
              },
              {
                icon: "🛠️",
                title: "Fix Guides",
                desc: "Step-by-step plain English instructions to fix every problem we find",
              },
              {
                icon: "🏆",
                title: "Rank Tracking",
                desc: "We track your Google ranking every month so you always know where you stand",
              },
            ].map((f, i) => (
              <div
                key={i}
                style={{
                  background: "#0D0F0E",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#F0EBE3",
                      marginBottom: 4,
                    }}
                  >
                    {f.title}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#6B7B78", lineHeight: 1.5 }}
                  >
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            className="rc-upgrade-btns"
            style={{ display: "flex", gap: 16, justifyContent: "center" }}
          >
            <button
              className="upgrade-btn no-print"
              onClick={handleUpgradeClick}
              style={{
                background: "#1ABC9C",
                color: "#000",
                border: "none",
                padding: "14px 36px",
                borderRadius: 8,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                transition: "opacity 0.2s",
              }}
            >
              Get Pro Access — $49/month →
            </button>
            <a
              href="/"
              style={{
                background: "transparent",
                color: "#6B7B78",
                border: "1px solid #2A3330",
                padding: "14px 28px",
                borderRadius: 8,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              ← Scan Another Clinic
            </a>
          </div>
        </div>
      </div>

      {/* UPGRADE POPUP */}
      {showUpgradePopup && !window?.matchMedia("print").matches && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => !leadSuccess && setShowUpgradePopup(false)}
        >
          <div
            style={{
              background: "#151918",
              border: "2px solid #1ABC9C",
              borderRadius: 20,
              padding: 48,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!leadSuccess ? (
              <>
                {/* Close button */}
                <button
                  onClick={() => setShowUpgradePopup(false)}
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    background: "transparent",
                    border: "none",
                    color: "#6B7B78",
                    fontSize: 20,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🦷</div>
                  <h2
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 28,
                      fontWeight: 900,
                      color: "#F0EBE3",
                      marginBottom: 8,
                    }}
                  >
                    Upgrade to Pro
                  </h2>
                  <p
                    style={{ fontSize: 15, color: "#6B7B78", lineHeight: 1.6 }}
                  >
                    Enter your details and we&apos;ll set up your Pro account
                    within 24 hours.
                  </p>
                </div>

                {/* Features */}
                <div
                  style={{
                    background: "#0D0F0E",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 28,
                  }}
                >
                  {[
                    "Monthly automated rescans",
                    "Competitor change alerts",
                    "Review request automation (SMS)",
                    "Step-by-step fix guides",
                    "Monthly PDF reports",
                  ].map((f) => (
                    <div
                      key={f}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        fontSize: 14,
                        color: "#F0EBE3",
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ color: "#1ABC9C", fontWeight: 700 }}>
                        ✓
                      </span>{" "}
                      {f}
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: "1px solid #2A3330",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 36,
                        fontWeight: 900,
                        color: "#1ABC9C",
                      }}
                    >
                      $49
                    </span>
                    <span style={{ fontSize: 14, color: "#6B7B78" }}>
                      /month
                    </span>
                  </div>
                </div>

                {/* Form */}
                <form
                  onSubmit={handleLeadSubmit}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    required
                    style={{
                      padding: "14px 18px",
                      borderRadius: 8,
                      border: "2px solid #2A3330",
                      background: "#0D0F0E",
                      color: "#F0EBE3",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 15,
                      outline: "none",
                    }}
                  />
                  <input
                    type="tel"
                    placeholder="Your phone number (with country code)"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    style={{
                      padding: "14px 18px",
                      borderRadius: 8,
                      border: "2px solid #2A3330",
                      background: "#0D0F0E",
                      color: "#F0EBE3",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 15,
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    style={{
                      background: "#1ABC9C",
                      color: "#000",
                      border: "none",
                      padding: "16px",
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: leadSubmitting ? "not-allowed" : "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      opacity: leadSubmitting ? 0.7 : 1,
                      marginTop: 4,
                    }}
                  >
                    {leadSubmitting
                      ? "Setting up your account..."
                      : "Get Pro Access →"}
                  </button>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#6B7B78",
                      textAlign: "center",
                    }}
                  >
                    We&apos;ll contact you within 24 hours to activate your
                    account
                  </p>
                </form>
              </>
            ) : (
              // Success state
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>🎉</div>
                <h2
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 28,
                    fontWeight: 900,
                    color: "#F0EBE3",
                    marginBottom: 12,
                  }}
                >
                  You&apos;re on the list!
                </h2>
                <p
                  style={{
                    fontSize: 16,
                    color: "#6B7B78",
                    lineHeight: 1.7,
                    marginBottom: 28,
                  }}
                >
                  We&apos;ll reach out to{" "}
                  <strong style={{ color: "#1ABC9C" }}>{leadEmail}</strong>{" "}
                  within 24 hours to set up your Pro account.
                </p>
                <button
                  onClick={() => setShowUpgradePopup(false)}
                  style={{
                    background: "#1ABC9C",
                    color: "#000",
                    border: "none",
                    padding: "14px 36px",
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Back to Report
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#0D0F0E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: "#1ABC9C", fontSize: 20 }}>Loading...</div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
