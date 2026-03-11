"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

  return (
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
        }}
      >
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div
          style={{
            fontSize: 20,
            color: "#F0EBE3",
            fontFamily: "'Playfair Display', serif",
          }}
        >
          {error}
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
          }}
        >
          ← Try Again
        </a>
      </div>
    );

  if (!data) return null;

  const gradeLabel =
    data.overallScore >= 70
      ? "✅ Good"
      : data.overallScore >= 40
        ? "⚠️ Needs Work"
        : "🚨 Critical";
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
      : "N/A";

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
      `}</style>

      {/* NAV */}
      <nav
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

      <div style={{ padding: "32px 40px" }}>
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
            Your Google Report
          </h1>
          <p style={{ fontSize: 14, color: "#6B7B78", marginTop: 4 }}>
            Scanned {new Date(data.scannedAt).toLocaleString()} · {city}
          </p>
        </div>

        {/* SCORE HERO */}
        <div
          className="card"
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
                label: `Google Search Position`,
                color: "#E74C3C",
                bg: "rgba(231,76,60,0.12)",
              },
              {
                icon: "⚡",
                value: data.performanceScore,
                label: "How Fast Your Website Loads",
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
                value: data.seoScore,
                label: "How Easy You Are to Find",
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
                value: data.accessibilityScore,
                label: "How Easy Your Website Is",
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
                  <div style={{ fontSize: 13, color: "#6B7B78", marginTop: 4 }}>
                    {m.label}
                  </div>
                </div>
              </div>
            ))}

            {/* Visibility banner — spans full width */}
            {data.competitors.length > 0 &&
              (() => {
                const yourRankNum = typeof userRank === "number" ? userRank : 8;
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
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
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
                            : `You're ranked #${yourRankNum} — outside the top 3`}
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

        {/* COMPETITORS */}
        {data.competitors.length > 0 && (
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
                  {new URL(url).hostname.replace("www.", "")}
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
                  Google Search Position
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
                .filter((c) => c.score <= data.overallScore)
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
                                {comp.name.length > 25
                                  ? comp.name.slice(0, 25) + "..."
                                  : comp.name}
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
                          {yourRankNum === 2
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
                            <span style={{ color: "#2ECC71", marginLeft: 4 }}>
                              ({data.overallScore - comp.score} behind)
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

        {/* REVIEW ANALYSIS */}
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
                Clinics with more reviews rank higher on Google and attract more
                patients. In fact,{" "}
                <span style={{ color: "#F0A500", fontWeight: 600 }}>
                  85% of patients
                </span>{" "}
                read Google reviews before choosing a dentist.
              </div>
              <div style={{ fontSize: 13, color: "#6B7B78", marginBottom: 24 }}>
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
                    style={{ fontSize: 15, color: "#F0EBE3", lineHeight: 1.6 }}
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
                        <span style={{ fontSize: 13, color, fontWeight: 700 }}>
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
                    style={{ fontSize: 14, color: "#F0EBE3", lineHeight: 1.6 }}
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
                style={{ background: "#0D0F0E", borderRadius: 12, padding: 20 }}
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
                style={{ background: "#0D0F0E", borderRadius: 12, padding: 20 }}
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
                  reviews.analysis.complaints.map((item: string, i: number) => (
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
                    <span>🎉</span>
                    <span>
                      No significant complaints found — your patients are happy!
                    </span>
                  </div>
                )}
              </div>

              {/* Fix now */}
              <div
                style={{ background: "#0D0F0E", borderRadius: 12, padding: 20 }}
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
                style={{ background: "#0D0F0E", borderRadius: 12, padding: 20 }}
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
            {[...failIssues, ...warnIssues, ...passIssues].map((issue, i) => {
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
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                      {icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          marginBottom: 4,
                          color:
                            issue.status === "pass" ? "#A0B0AD" : "#F0EBE3",
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
                            issue.priority === "HIGH" ? "#E74C3C" : "#F0A500",
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
            })}

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
                    style={{ color: "#1ABC9C", fontWeight: 700, flexShrink: 0 }}
                  >
                    →
                  </span>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>

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
            Get more patients — starting this month
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
            This report is a one-time snapshot. With Pro, we watch your clinic
            every month — alerting you when your score drops, when a competitor
            overtakes you, and when a patient leaves a bad review.
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
            Analyze reviews, competitor rankings, and discover what&apos;s
            holding your clinic back. Unlock insights that show exactly what to
            improve to reach the top.
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

          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
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
