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
  const city = searchParams.get("city") || "";

  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);

  const handleUpgradeClick = () => setShowUpgradePopup(true);

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
    fetch(
      `/api/audit?url=${encodeURIComponent(url)}&city=${encodeURIComponent(city)}`,
    )
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
        // Fetch reviews for the first competitor (most established clinic)
        if (d.competitors?.[0]?.name) {
          setReviewsLoading(true);
          fetch(
            `/api/reviews?name=${encodeURIComponent(d.competitors[0].name)}&city=${encodeURIComponent(d.competitors[0].address || city)}`,
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
  }, [url, city]);

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
          gap: 24,
        }}
      >
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: "4px solid #2A3330",
            borderTopColor: "#1ABC9C",
            animation: "spin 1s linear infinite",
          }}
        />
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24,
            color: "#F0EBE3",
          }}
        >
          Checking your Google ranking...
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#6B7B78",
            maxWidth: 300,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Checking your Google Visibility, speed, mobile friendliness and
          competitors in {city}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#1ABC9C",
                animation: `pulse 1.2s ease infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
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

  // Rank = position among competitors based on Google Visibility
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
            Google Ranking Report
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
              Google Health
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
                icon: "📍",
                value: `#${userRank}`,
                label: `Your rank in ${city}`,
                color: "#E74C3C",
                bg: "rgba(231,76,60,0.12)",
              },
              {
                icon: "⚡",
                value: data.performanceScore,
                label: "Performance score",
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
                label: "Google Visibility",
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
                icon: "♿",
                value: data.accessibilityScore,
                label: "Ease of Use",
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
              className="upgrade-btn"
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

        {/* ISSUES */}
        <div
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            marginBottom: 24,
            animationDelay: "0.3s",
          }}
        >
          {/* Fails & Warnings */}
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
                Issues Found
              </div>
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
                {failIssues.length + warnIssues.length} Issues
              </span>
            </div>
            {[...failIssues, ...warnIssues].map((issue, i) => (
              <div
                key={i}
                className="issue-row"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 0",
                  borderBottom: "1px solid #2A3330",
                  transition: "background 0.2s",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: issue.status === "fail" ? "#E74C3C" : "#F0A500",
                    boxShadow: `0 0 8px ${issue.status === "fail" ? "#E74C3C" : "#F0A500"}`,
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}
                  >
                    {issue.title}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#6B7B78", lineHeight: 1.5 }}
                  >
                    {issue.desc}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background:
                      issue.priority === "HIGH"
                        ? "rgba(231,76,60,0.12)"
                        : issue.priority === "MED"
                          ? "rgba(240,165,0,0.12)"
                          : "rgba(46,204,113,0.12)",
                    color:
                      issue.priority === "HIGH"
                        ? "#E74C3C"
                        : issue.priority === "MED"
                          ? "#F0A500"
                          : "#2ECC71",
                    fontFamily: "'DM Mono', monospace",
                    flexShrink: 0,
                  }}
                >
                  {issue.priority}
                </span>
              </div>
            ))}
            {failIssues.length + warnIssues.length === 0 && (
              <div
                style={{
                  fontSize: 14,
                  color: "#6B7B78",
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                🎉 No critical issues found!
              </div>
            )}
          </div>

          {/* Passing */}
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
                Passing Checks
              </div>
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
                {passIssues.length} Passing
              </span>
            </div>
            {passIssues.map((issue, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 0",
                  borderBottom: "1px solid #2A3330",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#2ECC71",
                    boxShadow: "0 0 8px #2ECC71",
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}
                  >
                    {issue.title}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#6B7B78", lineHeight: 1.5 }}
                  >
                    {issue.desc}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "rgba(46,204,113,0.12)",
                    color: "#2ECC71",
                    fontFamily: "'DM Mono', monospace",
                    flexShrink: 0,
                  }}
                >
                  GOOD
                </span>
              </div>
            ))}
            {passIssues.length === 0 && (
              <div
                style={{
                  fontSize: 14,
                  color: "#6B7B78",
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                Keep working on those issues above! 💪
              </div>
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
                ⚡ Quick Wins — Do These Today
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
                {city} Dental Rankings 📍
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
                {data.competitors.length} Clinics Found
              </span>
            </div>

            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr 140px 100px 80px",
                gap: 16,
                padding: "8px 0",
                fontSize: 11,
                color: "#6B7B78",
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                borderBottom: "1px solid #2A3330",
                marginBottom: 4,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              <div>#</div>
              <div>Clinic</div>
              <div>Google Score</div>
              <div>Reviews</div>
              <div>Status</div>
            </div>

            {data.competitors.map((comp, i) => {
              const isAhead = comp.score > data.overallScore;
              const scoreColor =
                comp.score >= 70
                  ? "#2ECC71"
                  : comp.score >= 40
                    ? "#F0A500"
                    : "#E74C3C";
              const fillClass =
                comp.score >= 70
                  ? "#2ECC71"
                  : comp.score >= 40
                    ? "#F0A500"
                    : "#E74C3C";

              return (
                <div
                  key={i}
                  className="comp-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr 140px 100px 80px",
                    gap: 16,
                    alignItems: "center",
                    padding: "14px 0",
                    borderBottom: "1px solid #2A3330",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      color: i === 0 ? "#F0A500" : "#6B7B78",
                      fontWeight: i === 0 ? 700 : 400,
                      textAlign: "center",
                    }}
                  >
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {comp.name}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#6B7B78", marginTop: 2 }}
                    >
                      {comp.address.split(",")[0]}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "#2A3330",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${comp.score}%`,
                          background: fillClass,
                          borderRadius: 3,
                          transition: "width 1s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 13,
                        color: scoreColor,
                        width: 28,
                        textAlign: "right",
                      }}
                    >
                      {comp.score}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7B78" }}>
                    <strong style={{ color: "#F0EBE3" }}>{comp.reviews}</strong>{" "}
                    ⭐{comp.rating}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: isAhead
                        ? "rgba(231,76,60,0.12)"
                        : "rgba(46,204,113,0.12)",
                      color: isAhead ? "#E74C3C" : "#2ECC71",
                      fontFamily: "'DM Mono', monospace",
                      textAlign: "center",
                    }}
                  >
                    {isAhead ? "AHEAD" : "BEHIND"}
                  </span>
                </div>
              );
            })}
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
              ⭐ Patient Review Analysis
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
          ) : reviews?.analysis ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              {/* Summary */}
              <div
                style={{
                  gridColumn: "1 / -1",
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
                  OVERALL SENTIMENT
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
                  💚 What Patients Love
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
                  🚨 Common Complaints
                </div>
                {reviews.analysis.complaints?.map((item, i) => (
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
                ))}
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
                  ⚡ Fix These Now
                </div>
                {reviews.analysis.fixNow?.map((item, i) => (
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
                ))}
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
                  📈 Promote These More
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
            Ready to climb to #1 in {city}?
          </div>
          <div
            style={{
              fontSize: 15,
              color: "#6B7B78",
              marginBottom: 28,
              maxWidth: 500,
              margin: "0 auto 28px",
            }}
          >
            Upgrade to Pro for monthly automated rescans, step-by-step fix
            guides, competitor tracking, and review automation.
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <button
              className="upgrade-btn"
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
              Upgrade to Pro — $49/month →
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
      {showUpgradePopup && (
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
