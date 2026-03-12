"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  initPaddle,
  onPaddleClose,
  openProCheckout,
  openGrowthCheckout,
  openTestCheckout,
} from "@/lib/paddle";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface AuditData {
  url: string;
  city: string;
  clinicName?: string;
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

// ─── UPGRADE MODAL ─────────────────────────────────────────────────────────────
// mode "both"        → free user  → shows Pro card (teal) + Growth card (gold)
// mode "growth-only" → pro user   → shows Growth card only
type UpgradeModalProps = {
  mode: "both" | "growth-only";
  clinicUrl: string;
  onClose: () => void;
  onSuccess: (plan: "pro" | "growth", email: string) => void;
};

function UpgradeModal({
  mode,
  clinicUrl,
  onClose,
  onSuccess,
}: UpgradeModalProps) {
  const [screen, setScreen] = useState<"plans" | "processing" | "success">(
    "plans",
  );
  const [successPlan, setSuccessPlan] = useState<"pro" | "growth">("pro");

  useEffect(() => {
    if (screen === "success") {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [screen, onClose]);

  const handleSelect = (plan: "pro" | "growth" | "test") => {
    const checkout =
      plan === "growth"
        ? openGrowthCheckout
        : plan === "test"
          ? openTestCheckout
          : openProCheckout;
    const effectivePlan: "pro" | "growth" = plan === "test" ? "pro" : plan;
    checkout(undefined, clinicUrl, async (customerEmail: string) => {
      setSuccessPlan(effectivePlan);
      setScreen("processing");

      // Wait for Paddle webhook to write to Supabase — poll up to 5×
      await new Promise((r) => setTimeout(r, 2000));
      let attempts = 0;
      const poll = async (): Promise<void> => {
        attempts++;
        try {
          const { data: sub } = await supabase
            .from("subscribers")
            .select("plan, status")
            .eq("email", customerEmail.toLowerCase().trim())
            .eq("status", "active")
            .single();
          if (sub) {
            setScreen("success");
            onSuccess(sub.plan as "pro" | "growth", customerEmail);
            return;
          }
        } catch {}
        if (attempts < 5)
          await new Promise((r) => setTimeout(r, 2000)).then(poll);
        else {
          // Webhook is slow — show success anyway
          setScreen("success");
          onSuccess(effectivePlan, customerEmail);
        }
      };
      poll();
    });
  };

  const proFeatures = [
    "Monthly automated checks",
    "Full 30-point Google report",
    "Competitor tracking (3 clinics)",
    "Review request automation",
    "Monthly progress report",
    "Step-by-step fix guides",
  ];

  const growthFeatures = [
    "Everything in Pro",
    "Competitor tracking (10 clinics)",
    "Google Ads automation",
    "Priority email support",
    "Quarterly strategy call",
  ];

  if (screen === "processing") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          background: "rgba(0,0,0,0.92)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#151918",
            borderRadius: 24,
            padding: 56,
            textAlign: "center",
            maxWidth: 400,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "4px solid #2A3330",
              borderTopColor: "#1ABC9C",
              animation: "spin 1s linear infinite",
              margin: "0 auto 28px",
            }}
          />
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 24,
              fontWeight: 700,
              color: "#F0EBE3",
              marginBottom: 12,
            }}
          >
            Activating your plan...
          </div>
          <div style={{ fontSize: 14, color: "#6B7B78" }}>
            Confirming your payment and setting up your account.
          </div>
        </div>
      </div>
    );
  }

  if (screen === "success") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          background: "rgba(0,0,0,0.92)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "#151918",
            borderRadius: 24,
            padding: 56,
            textAlign: "center",
            maxWidth: 480,
            width: "100%",
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            style={{ margin: "0 auto 24px", display: "block" }}
          >
            <circle
              cx="32"
              cy="32"
              r="32"
              fill={
                successPlan === "growth"
                  ? "rgba(212,168,67,0.15)"
                  : "rgba(26,188,156,0.15)"
              }
            />
            <path
              d="M20 32 L28 40 L44 24"
              stroke={successPlan === "growth" ? "#D4A843" : "#1ABC9C"}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 26,
              fontWeight: 900,
              color: "#F0EBE3",
              marginBottom: 16,
            }}
          >
            {successPlan === "growth"
              ? "No Cavities Found! 🦷🚀"
              : "Checkup Complete! 🦷⭐"}
          </div>
          <div
            style={{
              fontSize: 15,
              color: "#6B7B78",
              lineHeight: 1.7,
              marginBottom: 24,
            }}
          >
            {successPlan === "growth"
              ? "Your clinic is in perfect health. We're now tracking 10 competitors, automating review requests, and building your path to #1."
              : "Your practice just leveled up. Monthly rescans, 3 competitor slots, and review automation are all active — your dashboard is refreshing now."}
          </div>
          <div style={{ fontSize: 13, color: "#6B7B78" }}>
            Taking you to your dashboard...
          </div>
        </div>
      </div>
    );
  }

  // Plans screen
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#151918",
          borderRadius: 24,
          width: "100%",
          maxWidth: mode === "growth-only" ? 460 : 820,
          position: "relative",
          padding: 40,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            background: "transparent",
            border: "none",
            color: "#6B7B78",
            fontSize: 22,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2,
              color: "#1ABC9C",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {mode === "growth-only" ? "Upgrade Your Plan" : "Choose Your Plan"}
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 26,
              fontWeight: 900,
              color: "#F0EBE3",
            }}
          >
            {mode === "growth-only"
              ? "Take Your Clinic to the Next Level"
              : "Start Growing Your Practice Today"}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: mode === "growth-only" ? "1fr" : "1fr 1fr",
            gap: 20,
          }}
        >
          {/* PRO CARD — only shown in "both" mode */}
          {mode === "both" && (
            <div
              style={{
                background: "#0D0F0E",
                border: "2px solid #1ABC9C",
                borderRadius: 16,
                padding: 28,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#1ABC9C",
                  color: "#000",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "4px 16px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                  letterSpacing: 1,
                }}
              >
                MOST POPULAR
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#1ABC9C",
                  fontWeight: 700,
                  letterSpacing: 2,
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                Pro
              </div>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#F0EBE3",
                  marginBottom: 4,
                }}
              >
                $49
                <span
                  style={{ fontSize: 16, fontWeight: 400, color: "#6B7B78" }}
                >
                  /mo
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#6B7B78", marginBottom: 24 }}>
                For clinics serious about Google growth
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 28,
                }}
              >
                {proFeatures.map((f) => (
                  <div
                    key={f}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      fontSize: 13,
                      color: "#F0EBE3",
                    }}
                  >
                    <span
                      style={{
                        color: "#1ABC9C",
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </span>{" "}
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleSelect("pro")}
                style={{
                  background: "#1ABC9C",
                  color: "#000",
                  border: "none",
                  padding: "14px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  width: "100%",
                }}
              >
                Get Pro — $49/mo →
              </button>
            </div>
          )}

          {/* GROWTH CARD */}
          <div
            style={{
              background: "#0D0F0E",
              border: "2px solid #D4A843",
              borderRadius: 16,
              padding: 28,
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -12,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#D4A843",
                color: "#000",
                fontSize: 11,
                fontWeight: 800,
                padding: "4px 16px",
                borderRadius: 20,
                whiteSpace: "nowrap",
                letterSpacing: 1,
              }}
            >
              {mode === "growth-only" ? "YOUR NEXT LEVEL" : "BEST RESULTS"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#D4A843",
                fontWeight: 700,
                letterSpacing: 2,
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              Growth
            </div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 36,
                fontWeight: 900,
                color: "#F0EBE3",
                marginBottom: 4,
              }}
            >
              $99
              <span style={{ fontSize: 16, fontWeight: 400, color: "#6B7B78" }}>
                /mo
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#6B7B78", marginBottom: 24 }}>
              For clinics that want to dominate their city
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 28,
              }}
            >
              {growthFeatures.map((f) => (
                <div
                  key={f}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 13,
                    color: "#F0EBE3",
                  }}
                >
                  <span
                    style={{
                      color: "#D4A843",
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    ✓
                  </span>{" "}
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => handleSelect("growth")}
              style={{
                background: "#D4A843",
                color: "#000",
                border: "none",
                padding: "14px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                width: "100%",
              }}
            >
              Get Growth — $99/mo →
            </button>
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 12,
            color: "#6B7B78",
          }}
        >
          🔒 Secure checkout via Paddle · Cancel anytime
        </div>

        {/* TEST BUTTON — remove before going live */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={() => handleSelect("test")}
            style={{
              background: "transparent",
              border: "1px dashed #2A3330",
              color: "#3A5349",
              fontSize: 11,
              padding: "6px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            [DEV] Test checkout
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SCORE RING ────────────────────────────────────────────────────────────────
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

  const ToothSVG = () => {
    if (score >= 80) {
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
      return (
        <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
          <path
            d="M8 6 C8 2 14 0 22 0 C30 0 36 2 36 6 C40 8 44 14 44 22 C44 32 40 44 36 48 C34 52 30 52 28 48 C26 44 24 40 22 40 C20 40 18 44 16 48 C14 52 10 52 8 48 C4 44 0 32 0 22 C0 14 4 8 8 6Z"
            fill="#E8D5B0"
            stroke="#B8824A"
            strokeWidth="2"
          />
          <path
            d="M12 14 Q18 22 16 30"
            stroke="#8B4513"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M26 12 Q30 20 28 28"
            stroke="#8B4513"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="22" cy="32" r="4" fill="#7A3410" opacity="0.5" />
        </svg>
      );
    } else {
      return (
        <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
          <path
            d="M8 6 C8 2 14 0 22 0 C30 0 36 2 36 6 C40 8 44 14 44 22 C44 32 40 44 36 48 C34 52 30 52 28 48 C26 44 24 40 22 40 C20 40 18 44 16 48 C14 52 10 52 8 48 C4 44 0 32 0 22 C0 14 4 8 8 6Z"
            fill="#C8956C"
            stroke="#8B4513"
            strokeWidth="2.5"
          />
          <path
            d="M10 10 L34 42 M34 10 L10 42"
            stroke="#5C1A00"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.6"
          />
          <circle cx="22" cy="26" r="6" fill="#7A1A00" opacity="0.4" />
        </svg>
      );
    }
  };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 140,
        height: 140,
      }}
    >
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "rotate(-90deg)",
        }}
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#1A2320"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.5s ease" }}
        />
      </svg>
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <ToothSVG />
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 20,
            fontWeight: 700,
            color,
            lineHeight: 1,
            marginTop: 6,
          }}
        >
          {score}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: -28,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          color: "#6B7B78",
          whiteSpace: "nowrap",
          fontWeight: 500,
        }}
      >
        {toothLabel}
      </div>
    </div>
  );
}

// ─── URL NORMALIZER ────────────────────────────────────────────────────────────
// Strips protocol, www., and trailing slash so all variants map to the same key
// e.g. https://www.site.com/ → site.com
function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

// ─── DASHBOARD CONTENT ────────────────────────────────────────────────────────
function DashboardContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || "";
  const city = searchParams.get("city") || "";

  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "competitors" | "roadmap" | "reviews" | "score" | "health"
  >("competitors");
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [patientValue, setPatientValue] = useState(150);
  const [reviewContact, setReviewContact] = useState("");
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Plan state
  const [isPro, setIsPro] = useState(false);
  const [isGrowth, setIsGrowth] = useState(false);

  // Post-payment unlock animation
  const [showUnlockAnim, setShowUnlockAnim] = useState(false);

  // Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // "I'm already Pro" re-auth modal (for free users who lost localStorage)
  const [showProLogin, setShowProLogin] = useState(false);
  const [proLoginEmail, setProLoginEmail] = useState("");
  const [proLoginError, setProLoginError] = useState("");
  const [proLoginLoading, setProLoginLoading] = useState(false);

  const applyPlan = (plan: "pro" | "growth", email: string) => {
    localStorage.setItem("rc_pro_email", email.toLowerCase().trim());

    if (plan === "growth") {
      setIsPro(false);
      setIsGrowth(true);
    } else {
      setIsPro(true);
      setIsGrowth(false);
    }

    setShowUpgradeModal(false);
    onPaddleClose(() => {
      setShowUnlockAnim(true);
      setTimeout(() => setShowUnlockAnim(false), 3000);
    });
  };

  // Look up subscriber by clinic_url (primary) or email (fallback)
  const checkByUrl = async (clinicUrl: string) => {
    try {
      const { data: sub } = await supabase
        .from("subscribers")
        .select("email, plan, status")
        .eq("clinic_url", normalizeUrl(clinicUrl))
        .eq("status", "active")
        .single();
      if (sub) {
        applyPlan(sub.plan as "pro" | "growth", sub.email);
        return true;
      }
    } catch {}
    return false;
  };

  const checkByEmail = async (email: string): Promise<boolean> => {
    try {
      const { data: sub } = await supabase
        .from("subscribers")
        .select("plan, status")
        .eq("email", email.toLowerCase().trim())
        .eq("status", "active")
        .single();
      if (sub) {
        applyPlan(sub.plan as "pro" | "growth", email);
        return true;
      }
    } catch {}
    return false;
  };

  // On mount: check by clinic_url first, then localStorage email
  useEffect(() => {
    const detect = async () => {
      if (url) {
        const found = await checkByUrl(url);
        if (found) return;
      }
      const saved = localStorage.getItem("rc_pro_email");
      if (saved) checkByEmail(saved);
    };
    detect();
    initPaddle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Fetch audit data
  useEffect(() => {
    if (!url) return;
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
      })
      .catch(() => {
        setError("Failed to audit. Please try again.");
        setLoading(false);
      });
    return () => clearInterval(interval);
  }, [url, city]);

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

  const loadingSteps = [
    { icon: "⚡", label: "Checking website speed..." },
    { icon: "🔍", label: "Analyzing Google visibility..." },
    { icon: "🏆", label: `Finding competitors in ${city}...` },
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
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
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

  const userRank =
    data.competitors.length > 0
      ? (() => {
          const allScores = [
            ...data.competitors.map((c) => c.score),
            data.overallScore,
          ];
          allScores.sort((a, b) => b - a);
          return allScores.indexOf(data.overallScore) + 1;
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
        @keyframes spin { to { transform: rotate(360deg); } }
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
          .rc-score-hero { grid-template-columns: 1fr !important; }
          .rc-metric-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .rc-hero-review { flex-direction: column !important; align-items: stretch !important; }
          .rc-hero-review > div:last-child { min-width: unset !important; width: 100% !important; }
          .rc-hero-review-row { flex-direction: column !important; }
          .rc-hero-review-row input { width: 100% !important; }
          .rc-hero-review-row button { width: 100% !important; }
          .rc-competitor-grid { grid-template-columns: 1fr !important; }
          .rc-tab-btn { font-size: 11px !important; padding: 8px 6px !important; }
          .rc-main { padding: 16px !important; }
          nav { padding: 12px 16px !important; }
          .rc-upgrade-grid { grid-template-columns: 1fr !important; }
          .rc-upgrade-btns { flex-direction: column !important; align-items: stretch !important; }
          .rc-gap-grid { grid-template-columns: 1fr !important; }
          .rc-gap-vs { display: none !important; }
          .rc-roadmap-item { flex-wrap: wrap !important; }
        }
        @media (max-width: 480px) {
          .rc-metric-grid { grid-template-columns: 1fr !important; }
          .rc-tab-btn { font-size: 10px !important; padding: 6px 3px !important; }
          h1 { font-size: 22px !important; }
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

          {isGrowth ? (
            <div
              style={{
                background: "rgba(212,168,67,0.1)",
                border: "1px solid #D4A843",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                color: "#D4A843",
              }}
            >
              🚀 Growth Active
            </div>
          ) : isPro ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  background: "rgba(26,188,156,0.1)",
                  border: "1px solid #1ABC9C",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1ABC9C",
                }}
              >
                ⭐ Pro Active
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                style={{
                  background: "#D4A843",
                  color: "#000",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Upgrade to Growth →
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowUpgradeModal(true)}
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
              }}
            >
              Upgrade →
            </button>
          )}
        </div>
      </nav>

      {/* MAIN */}
      <div
        className="rc-main"
        style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px" }}
      >
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 30,
              fontWeight: 900,
              marginBottom: 6,
              color: "#F0EBE3",
            }}
          >
            {data?.clinicName ||
              (url
                ? url
                    .replace(/https?:\/\//, "")
                    .replace(/^www\./, "")
                    .split("/")[0]
                    .replace(/\.(com|net|org|io|us|dental|care|health)$/, "")
                    .replace(/[-_.]/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())
                    .trim()
                : "Your Clinic")}
            &apos;s Growth Intelligence Report
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(26,188,156,0.1)",
                border: "1px solid rgba(26,188,156,0.3)",
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
                color: "#1ABC9C",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              ✦ AI Powered
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid #2A3330",
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 11,
                color: "#6B7B78",
              }}
            >
              📡 Powered by Google Maps, Google PageSpeed & live web data
            </span>
          </div>
        </div>

        {/* SCORE HERO */}
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
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(107,123,120,0.6)",
                        marginTop: 2,
                        fontStyle: "italic",
                      }}
                    >
                      {m.sublabel}
                    </div>
                  </div>
                </div>
              ))}

              {/* Visibility banner */}
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
                      {!inTopThree && !isGrowth && (
                        <button
                          onClick={() => setShowUpgradeModal(true)}
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

        {/* UPGRADE BANNER — free users with low score */}
        {data.overallScore < 70 && !isPro && !isGrowth && (
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
              onClick={() => setShowUpgradeModal(true)}
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

        {/* HERO REVIEW BLOCK */}
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

        {/* GROWTH UPSELL BANNER — pro users only */}
        {isPro && !isGrowth && (
          <div
            className="card"
            style={{
              background: "linear-gradient(135deg, #2a1f0a, #1f1500)",
              border: "1px solid rgba(212,168,67,0.3)",
              borderRadius: 16,
              padding: "24px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
              animationDelay: "0.2s",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                🚀 Ready to dominate {city}?
              </div>
              <div style={{ fontSize: 14, color: "#6B7B78" }}>
                Upgrade to Growth for done-for-you SEO fixes, priority support,
                and weekly ranking updates.
              </div>
            </div>
            <button
              className="upgrade-btn no-print"
              onClick={() => setShowUpgradeModal(true)}
              style={{
                background: "#D4A843",
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
              Upgrade to Growth — $99/mo →
            </button>
          </div>
        )}

        {/* TOP 3 PRIORITIES */}
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

        {/* TABS */}
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

        {/* COMPETITORS TAB */}
        {activeTab === "competitors" && (
          <>
            {data.competitors.length > 0 &&
              reviews &&
              (() => {
                const topComp = [...data.competitors].sort(
                  (a, b) => b.score - a.score,
                )[0];
                const ratingGap = (
                  (topComp.rating || 0) - (reviews.rating || 0)
                ).toFixed(1);
                const reviewGap = (topComp.reviews || 0) - (reviews.total || 0);
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
                      className="rc-gap-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        gap: 16,
                        alignItems: "center",
                      }}
                    >
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
                          <div>
                            <div
                              style={{
                                fontSize: 22,
                                fontWeight: 900,
                                color: "#1ABC9C",
                                fontFamily: "'Playfair Display', serif",
                              }}
                            >
                              {data.overallScore}
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7B78" }}>
                              Google Score
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className="rc-gap-vs"
                        style={{
                          textAlign: "center",
                          color: "#2A3330",
                          fontSize: 24,
                          fontWeight: 900,
                        }}
                      >
                        vs
                      </div>
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
                          Top Competitor
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
                              {topComp.rating?.toFixed(1) ?? "—"} ⭐
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7B78" }}>
                              Google Rating{" "}
                              <span
                                style={{
                                  color:
                                    Number(ratingGap) > 0
                                      ? "#E74C3C"
                                      : "#2ECC71",
                                }}
                              >
                                (
                                {Number(ratingGap) > 0
                                  ? `+${ratingGap} ahead`
                                  : "you're ahead!"}
                                )
                              </span>
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
                              {topComp.reviews ?? "—"}
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7B78" }}>
                              Reviews{" "}
                              <span
                                style={{
                                  color: reviewGap > 0 ? "#E74C3C" : "#2ECC71",
                                }}
                              >
                                (
                                {reviewGap > 0
                                  ? `+${reviewGap} ahead`
                                  : "you're ahead!"}
                                )
                              </span>
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
                              {topComp.score}
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7B78" }}>
                              Google Score
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

            <div
              className="card rc-competitor-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
                marginBottom: 24,
                animationDelay: "0.4s",
              }}
            >
              {/* Your clinic card */}
              <div
                style={{
                  background: "rgba(26,188,156,0.06)",
                  border: "2px solid rgba(26,188,156,0.4)",
                  borderRadius: 14,
                  padding: 20,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 4,
                    background: "rgba(26,188,156,0.15)",
                    color: "#1ABC9C",
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: 1,
                  }}
                >
                  YOU
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#F0EBE3",
                    marginBottom: 4,
                  }}
                >
                  {
                    url
                      .replace(/https?:\/\//, "")
                      .replace(/www\./, "")
                      .split("/")[0]
                  }
                </div>
                <div
                  style={{ fontSize: 13, color: "#6B7B78", marginBottom: 16 }}
                >
                  {city}
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 24,
                        fontWeight: 900,
                        color: "#1ABC9C",
                      }}
                    >
                      {reviews?.rating?.toFixed(1) ?? "—"} ⭐
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7B78" }}>
                      {reviews?.total ?? 0} reviews
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 24,
                        fontWeight: 900,
                        color: "#1ABC9C",
                      }}
                    >
                      {data.overallScore}
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7B78" }}>
                      Google score
                    </div>
                  </div>
                </div>
              </div>
              {/* Competitor cards */}
              {data.competitors
                .slice(0, isPro ? undefined : 2)
                .map((comp, i) => (
                  <div
                    key={i}
                    className="comp-row"
                    style={{
                      background: "#151918",
                      border: "1px solid #2A3330",
                      borderRadius: 14,
                      padding: 20,
                      transition: "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#F0EBE3",
                          paddingRight: 8,
                        }}
                      >
                        {comp.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background:
                            comp.score > data.overallScore
                              ? "rgba(231,76,60,0.12)"
                              : "rgba(46,204,113,0.12)",
                          color:
                            comp.score > data.overallScore
                              ? "#E74C3C"
                              : "#2ECC71",
                          fontFamily: "'DM Mono', monospace",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        #{i + 1 + 1}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6B7B78",
                        marginBottom: 12,
                      }}
                    >
                      {comp.address}
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div>
                        <div
                          style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: 20,
                            fontWeight: 900,
                            color:
                              comp.rating >= (reviews?.rating || 0)
                                ? "#E74C3C"
                                : "#2ECC71",
                          }}
                        >
                          {comp.rating?.toFixed(1)} ⭐
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7B78" }}>
                          {comp.reviews} reviews
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: 20,
                            fontWeight: 900,
                            color:
                              comp.score > data.overallScore
                                ? "#E74C3C"
                                : "#2ECC71",
                          }}
                        >
                          {comp.score}
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7B78" }}>
                          Google score
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {/* Locked competitors for free users */}
              {!isPro && data.competitors.length > 2 && (
                <div
                  style={{
                    background: "#151918",
                    border: "1px dashed #2A3330",
                    borderRadius: 14,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: 10,
                    gridColumn:
                      data.competitors.length > 3 ? "1 / -1" : undefined,
                  }}
                >
                  <div style={{ fontSize: 28 }}>🔒</div>
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: "#6B7B78" }}
                  >
                    {data.competitors.length - 2} more competitors hidden
                  </div>
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    style={{
                      background: "#1ABC9C",
                      color: "#000",
                      border: "none",
                      padding: "8px 20px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Unlock with Pro →
                  </button>
                </div>
              )}
            </div>
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
              animationDelay: "0.45s",
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
                🗺️ Your Path to #1
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: "rgba(212,168,67,0.1)",
                  color: "#D4A843",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                GROWTH ROADMAP
              </span>
            </div>

            {(() => {
              const aheadComps = [...data.competitors]
                .filter((c) => c.score >= data.overallScore)
                .sort((a, b) => a.score - b.score);
              const behindComps = [...data.competitors].filter(
                (c) => c.score < data.overallScore,
              );
              const stepsToShow = isPro ? aheadComps : aheadComps.slice(0, 1);
              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {stepsToShow.map((comp, i) => {
                    const gap = comp.score - data.overallScore;
                    const reviewGap = Math.max(
                      0,
                      (comp.reviews || 0) - (reviews?.total || 0),
                    );
                    const weeks =
                      gap <= 5
                        ? "2–4 weeks"
                        : gap <= 15
                          ? "1–2 months"
                          : "2–4 months";
                    const isLocked = !isPro && i > 0;
                    return (
                      <div
                        key={i}
                        className="rc-roadmap-item"
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 16,
                          padding: "16px 20px",
                          borderRadius: 12,
                          background: isLocked
                            ? "#0D0F0E"
                            : "rgba(240,165,0,0.04)",
                          border: `1px solid ${isLocked ? "#1A1F1E" : "rgba(240,165,0,0.2)"}`,
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
                    );
                  })}

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
                        opacity: isPro ? 1 : 0.5,
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
                        {isGrowth ? (
                          <div style={{ fontSize: 12, color: "#2ECC71" }}>
                            ✅ Full growth plan is active — keep following the
                            steps above!
                          </div>
                        ) : isPro ? (
                          <div style={{ fontSize: 12, color: "#6B7B78" }}>
                            🚀 Upgrade to Growth for a done-for-you accelerated
                            plan
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#6B7B78" }}>
                            🔒 Get Pro to unlock your full step-by-step growth
                            plan
                          </div>
                        )}
                      </div>
                      {!isGrowth && (
                        <button
                          onClick={() => setShowUpgradeModal(true)}
                          style={{
                            background: isPro ? "#D4A843" : "#2ECC71",
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
                          {isPro ? "Get Growth →" : "Get Pro →"}
                        </button>
                      )}
                    </div>
                  )}

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
                    margin: "0 auto 20px",
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
                {!isGrowth && (
                  <button
                    onClick={() => setShowUpgradeModal(true)}
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
                    {isPro
                      ? "Upgrade to Growth for Automated Reviews →"
                      : "Get More Reviews with Pro →"}
                  </button>
                )}
              </div>
            ) : reviews?.analysis ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
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
                      HOW OFTEN YOU REPLY TO REVIEWS
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

        {/* SCORE / INTELLIGENCE TAB */}
        {activeTab === "score" && (
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
                🧠 Growth Intelligence
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
                AI POWERED
              </span>
            </div>

            {/* Patient Value Calculator */}
            <div
              style={{
                background: "#0D0F0E",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#F0EBE3",
                  marginBottom: 4,
                }}
              >
                💰 What Each New Patient Is Worth
              </div>
              <div style={{ fontSize: 13, color: "#6B7B78", marginBottom: 16 }}>
                Adjust your average patient lifetime value to see your revenue
                potential.
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <input
                  type="range"
                  min={50}
                  max={1000}
                  step={50}
                  value={patientValue}
                  onChange={(e) => setPatientValue(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#1ABC9C" }}
                />
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 28,
                    fontWeight: 900,
                    color: "#1ABC9C",
                    minWidth: 80,
                  }}
                >
                  ${patientValue}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                }}
              >
                {[
                  { label: "5 new patients/mo", value: patientValue * 5 },
                  { label: "10 new patients/mo", value: patientValue * 10 },
                  { label: "20 new patients/mo", value: patientValue * 20 },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      background: "#151918",
                      borderRadius: 10,
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 22,
                        fontWeight: 900,
                        color: "#2ECC71",
                      }}
                    >
                      ${value.toLocaleString()}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#6B7B78", marginTop: 4 }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score breakdown */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
              }}
            >
              {[
                {
                  label: "Website Speed",
                  score: data.performanceScore,
                  icon: "⚡",
                  desc: "How fast your site loads for patients",
                },
                {
                  label: "Google Findability",
                  score: data.seoScore,
                  icon: "🔍",
                  desc: "How easily Google can find and rank you",
                },
                {
                  label: "Website Usability",
                  score: data.accessibilityScore,
                  icon: "👆",
                  desc: "How easy your site is to use on mobile",
                },
              ].map(({ label, score, icon, desc }) => {
                const color =
                  score >= 70 ? "#2ECC71" : score >= 40 ? "#F0A500" : "#E74C3C";
                return (
                  <div
                    key={label}
                    style={{
                      background: "#0D0F0E",
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6B7B78",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 36,
                        fontWeight: 900,
                        color,
                        marginBottom: 4,
                      }}
                    >
                      {score || "—"}
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "#2A3330",
                        borderRadius: 3,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          height: 6,
                          background: color,
                          borderRadius: 3,
                          width: `${score}%`,
                          transition: "width 1s ease",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7B78" }}>{desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* HEALTH TAB */}
        {activeTab === "health" && (
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
                🔧 Website Health Check
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {failIssues.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 12px",
                      borderRadius: 20,
                      background: "rgba(231,76,60,0.1)",
                      color: "#E74C3C",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {failIssues.length} ISSUES
                  </span>
                )}
                {passIssues.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 12px",
                      borderRadius: 20,
                      background: "rgba(46,204,113,0.1)",
                      color: "#2ECC71",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {passIssues.length} PASSING
                  </span>
                )}
              </div>
            </div>

            {[...failIssues, ...warnIssues, ...passIssues].map((issue, i) => {
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
                    padding: "14px 16px",
                    borderRadius: 10,
                    marginBottom: 4,
                    cursor: "pointer",
                    transition: "background 0.2s",
                    background: isExpanded
                      ? "rgba(26,188,156,0.04)"
                      : "transparent",
                  }}
                  onClick={() => setExpandedIssue(isExpanded ? null : i)}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: dotColor,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#F0EBE3",
                        }}
                      >
                        {issue.title}
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#6B7B78", marginTop: 2 }}
                      >
                        {issue.desc}
                      </div>
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
            {isGrowth
              ? "You're on the Growth plan — keep climbing! 🚀"
              : isPro
                ? "Ready to grow even faster?"
                : "Don't lose patients to nearby competitors."}
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
            {isGrowth
              ? "You have full access to all features. Keep monitoring your ranking and responding to reviews every week."
              : isPro
                ? "Upgrade to Growth for done-for-you SEO fixes, weekly check-ins, and priority support to reach #1 faster."
                : "Stay ahead of nearby clinics and keep attracting new patients. Monitor reviews, rankings and competitor moves every month — so you're always one step ahead."}
          </div>

          {!isGrowth && (
            <>
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
                {(isPro
                  ? [
                      {
                        icon: "🛠️",
                        title: "Done-For-You Fixes",
                        desc: "We implement SEO and speed fixes directly on your site — no developer needed",
                      },
                      {
                        icon: "📅",
                        title: "Weekly Updates",
                        desc: "Get a ranking update every week so you always know if you're gaining or losing ground",
                      },
                      {
                        icon: "👤",
                        title: "Dedicated Manager",
                        desc: "A real person reviews your account monthly and gives you a personalised action plan",
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
                        icon: "🏆",
                        title: "Rank Tracking",
                        desc: "We track your Google ranking weekly so you always know where you stand",
                      },
                    ]
                  : [
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
                    ]
                ).map((f, i) => (
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
                        style={{
                          fontSize: 12,
                          color: "#6B7B78",
                          lineHeight: 1.5,
                        }}
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
                  onClick={() => setShowUpgradeModal(true)}
                  style={{
                    background: isPro ? "#D4A843" : "#1ABC9C",
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
                  {isPro
                    ? "Upgrade to Growth — $99/month →"
                    : "Get Pro Access — $49/month →"}
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
            </>
          )}

          {isGrowth && (
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
          )}
        </div>
      </div>

      {/* UNLOCK ANIMATION — shown briefly after successful payment */}
      {showUnlockAnim && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeInOut 3s ease forwards",
            pointerEvents: "none",
          }}
        >
          <style>{`
            @keyframes fadeInOut {
              0%   { opacity: 0; }
              15%  { opacity: 1; }
              75%  { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes unlockPulse {
              0%   { transform: scale(0.6); opacity: 0; }
              50%  { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes unlockRing {
              0%   { transform: scale(0.5); opacity: 0.8; }
              100% { transform: scale(2.2); opacity: 0; }
            }
          `}</style>
          <div style={{ position: "relative", width: 100, height: 100 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "2px solid #1ABC9C",
              animation: "unlockRing 1.2s ease-out forwards",
            }} />
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "2px solid #1ABC9C",
              animation: "unlockRing 1.2s ease-out 0.3s forwards",
              opacity: 0,
            }} />
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(26,188,156,0.12)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "unlockPulse 0.6s ease forwards",
            }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M14 24 L22 32 L34 16"
                  stroke="#1ABC9C" strokeWidth="3.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="40"
                  strokeDashoffset="40"
                  style={{ animation: "dash 0.5s ease 0.4s forwards" }}
                />
              </svg>
            </div>
          </div>
          <div style={{
            marginTop: 28,
            fontFamily: "'Playfair Display', serif",
            fontSize: 22,
            fontWeight: 800,
            color: "#F0EBE3",
            letterSpacing: 0.5,
          }}>
            You&apos;re unlocked
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: "#6B7B78" }}>
            Your full dashboard is ready
          </div>
          <style>{`
            @keyframes dash {
              to { stroke-dashoffset: 0; }
            }
          `}</style>
        </div>
      )}

      {/* UPGRADE MODAL */}
      {showUpgradeModal && (
        <UpgradeModal
          mode={isPro && !isGrowth ? "growth-only" : "both"}
          clinicUrl={url}
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={(plan, email) => {
            applyPlan(plan, email);
          }}
        />
      )}

      {/* "I'M ALREADY PRO" RE-AUTH MODAL — free users only */}
      {showProLogin && (
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
          onClick={() => setShowProLogin(false)}
        >
          <div
            style={{
              background: "#151918",
              border: "1px solid #2A3330",
              borderRadius: 20,
              padding: 40,
              width: "100%",
              maxWidth: 420,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 24,
                  fontWeight: 900,
                  color: "#F0EBE3",
                  marginBottom: 8,
                }}
              >
                Restore Your Pro Access
              </h2>
              <p style={{ fontSize: 14, color: "#6B7B78", lineHeight: 1.6 }}>
                Enter the email you used to subscribe.
              </p>
            </div>
            <input
              type="email"
              placeholder="your@email.com"
              value={proLoginEmail}
              onChange={(e) => {
                setProLoginEmail(e.target.value);
                setProLoginError("");
              }}
              style={{
                width: "100%",
                background: "#0D0F0E",
                border: "1px solid #2A3330",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#F0EBE3",
                fontSize: 14,
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />
            {proLoginError && (
              <div style={{ fontSize: 12, color: "#E74C3C", marginBottom: 12 }}>
                {proLoginError}
              </div>
            )}
            <button
              onClick={async () => {
                if (!proLoginEmail.trim()) return;
                setProLoginLoading(true);
                setProLoginError("");
                const found = await checkByEmail(proLoginEmail);
                if (found) setShowProLogin(false);
                else
                  setProLoginError(
                    "No active subscription found for this email.",
                  );
                setProLoginLoading(false);
              }}
              disabled={proLoginLoading || !proLoginEmail.trim()}
              style={{
                width: "100%",
                background: "#1ABC9C",
                color: "#000",
                border: "none",
                borderRadius: 8,
                padding: "14px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 12,
                opacity: proLoginLoading || !proLoginEmail.trim() ? 0.6 : 1,
              }}
            >
              {proLoginLoading ? "Checking..." : "Unlock My Access →"}
            </button>
            <button
              onClick={() => setShowProLogin(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#6B7B78",
                fontSize: 13,
                cursor: "pointer",
                width: "100%",
              }}
            >
              Close
            </button>
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
