"use client";
import { useEffect, useState, Suspense, useRef } from "react";
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
    googleRank: number;
    lat?: number;
    lng?: number;
  }[];
  placeId: string;
  scannedAt: string;
  userLat?: number;
  userLng?: number;
  userRank?: number;
  userReviewCount?: number;
  yelpRating?: number;
  yelpReviewCount?: number;
  yelpUrl?: string;
  yelpRank?: number;
  yelpCompetitors?: { name: string; rating: number; reviews: number; rank: number; url?: string }[];
  healthgradesFound?: boolean;
  healthgradesRating?: number;
  healthgradesReviews?: number;
  healthgradesClaimed?: boolean;
  healthgradesUrl?: string;
  notInTop60?: boolean;
  smoothedRank?: number;
  rankRangeLow?: number;
  rankRangeHigh?: number;
}

interface ReviewData {
  rating: number;
  total: number;
  reviews: { author: string; rating: number; text: string; time: string; source?: string }[];
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
  reviewSources?: { google: number; yelp: number };
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
    "Regular scans to track whether your ranking position is improving.",
    "Detailed breakdown of the exact signals affecting your local search visibility.",
    "See which nearby clinics are attracting patients before you.",
    "Automatically ask patients for reviews — the fastest way to improve local ranking.",
    "Track whether your local search visibility is improving month-to-month.",
    "Clear actions to help improve ranking signals and patient discovery.",
  ];

  const growthFeatures = [
    "Everything in Pro",
    "Connect your Google Business Profile for deeper ranking insights.",
    "AI analysis of your review trends to identify what's driving or limiting your ranking.",
    "Monitor up to 10 nearby competitors to stay ahead of ranking changes.",
    "Priority support to help you act on visibility improvements faster.",
    "Quarterly strategy session to review your ranking progress and adjust your plan.",
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
        className="rc-upgrade-modal"
        style={{
          background: "#151918",
          borderRadius: 24,
          width: "100%",
          maxWidth: mode === "growth-only" ? 460 : 820,
          position: "relative",
          padding: 40,
          boxSizing: "border-box" as const,
          animation: "modalEnter 0.24s ease-out both",
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
            {mode === "growth-only" ? "Unlock Growth Plan" : "Choose Your Plan"}
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 26,
              fontWeight: 900,
              color: "#F0EBE3",
              marginBottom: 8,
            }}
          >
            {mode === "growth-only"
              ? "Start Recovering the Patients You're Missing"
              : "Start Recovering the Patients You're Missing"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(240,235,227,0.45)", lineHeight: 1.6 }}>
            Even a small improvement in local ranking can generate additional treatment enquiries each month.
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
                For clinics that want to improve local ranking visibility and attract more patient enquiries.
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
                Start Improving My Ranking — $49/mo
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
              For clinics aiming to consistently appear ahead of nearby competitors in local searches.
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
              Unlock Full Visibility Plan — $99/mo
            </button>
          </div>
        </div>

        {/* Trust + reassurance */}
        <div style={{ textAlign: "center", marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#4A5A57", letterSpacing: 0.3 }}>
            Built specifically for dental clinics improving their Google visibility.
          </div>
          <div style={{ fontSize: 12, color: "#6B7B78", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" as const }}>
            <span>✓ Cancel anytime</span>
            <span>✓ No long-term contracts</span>
            <span>✓ Setup takes minutes</span>
          </div>
          <div style={{ fontSize: 11, color: "#3A4A47" }}>
            🔒 Secure checkout via Paddle
          </div>
        </div>

        {/* TEST BUTTON — uncomment to test checkout flow
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
        */}
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

// ─── MAP VIEW ─────────────────────────────────────────────────────────────────
function MapView({ data, isPro = false, onUpgrade }: { data: AuditData; isPro?: boolean; onUpgrade?: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !data.userLat || !data.userLng || !mapRef.current) return;

    const initMap = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = (window as any).google.maps;
      const center = { lat: data.userLat!, lng: data.userLng! };
      const map = new G.Map(mapRef.current, {
        center,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a2421" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#8EC5B0" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0D1714" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#2A3A35" }] },
          { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6B9E8A" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0D2118" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });

      const infoWindow = new G.InfoWindow();
      map.addListener("click", () => infoWindow.close());

      // 5km radius circle
      new G.Circle({
        map,
        center,
        radius: 5000,
        strokeColor: "#1ABC9C",
        strokeOpacity: 0.4,
        strokeWeight: 1.5,
        fillColor: "#1ABC9C",
        fillOpacity: 0.05,
      });

      // User clinic marker — larger with YOU label
      const userMarker = new G.Marker({
        position: center,
        map,
        title: data.clinicName || "Your Clinic",
        label: {
          text: "YOU",
          color: "#000",
          fontWeight: "900",
          fontSize: "9px",
          fontFamily: "sans-serif",
        },
        icon: {
          path: G.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: "#1ABC9C",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
        },
        zIndex: 200,
      });
      userMarker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="color:#111;font-family:sans-serif;padding:4px 2px;max-width:200px">
            <b>${data.clinicName || "Your Clinic"}</b><br/>
            📍 Rank #${data.userRank ?? "?"}<br/>
            ⭐ ${data.userReviewCount ?? 0} reviews
          </div>`
        );
        infoWindow.open(map, userMarker);
      });

      // Competitor markers
      data.competitors.forEach((c) => {
        if (c.lat == null || c.lng == null) return;
        const color = c.googleRank <= 3 ? "#2ECC71" : c.googleRank <= 10 ? "#F0A500" : "#E74C3C";
        const marker = new G.Marker({
          position: { lat: c.lat, lng: c.lng },
          map,
          title: isPro ? c.name : "Competitor",
          icon: {
            path: G.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: isPro ? color : "#4A5A57",
            fillOpacity: isPro ? 0.9 : 0.4,
            strokeColor: "#fff",
            strokeWeight: isPro ? 2 : 1,
          },
          zIndex: 100,
        });
        if (isPro) {
          marker.addListener("click", () => {
            infoWindow.setContent(
              `<div style="color:#111;font-family:sans-serif;padding:4px 2px;max-width:200px">
                <b>#${c.googleRank} ${c.name}</b><br/>
                ⭐ ${c.rating} · ${c.reviews} reviews<br/>
                <span style="color:#666;font-size:11px">${c.address}</span>
              </div>`
            );
            infoWindow.open(map, marker);
          });
        } else {
          marker.addListener("click", () => {
            infoWindow.setContent(
              `<div style="color:#111;font-family:sans-serif;padding:6px 4px;max-width:200px;text-align:center">
                🔒 <b>Patient traffic hidden</b><br/>
                <span style="font-size:12px;color:#555">This clinic may be capturing patients searching near you</span>
              </div>`
            );
            infoWindow.open(map, marker);
          });
        }
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) {
      initMap();
    } else {
      const existing = document.getElementById("gmaps-script");
      if (existing) {
        existing.addEventListener("load", initMap);
      } else {
        const script = document.createElement("script");
        script.id = "gmaps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.onload = initMap;
        document.head.appendChild(script);
      }
    }
  }, [data]);

  if (!data.userLat || !data.userLng) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6B7B78", fontSize: 14 }}>
        Location data unavailable for this clinic.
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div ref={mapRef} className="rc-map-wrap" style={{ width: "100%", height: 420, borderRadius: 12, overflow: "hidden" }} />
      {!isPro && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(to top, rgba(10,14,12,0.97) 55%, transparent)",
          borderRadius: "0 0 12px 12px",
          padding: "40px 24px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#F0EBE3", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#E74C3C", boxShadow: "0 0 6px #E74C3C", flexShrink: 0 }} />
              {data.competitors.length > 0
                ? `${data.competitors.length} nearby clinics are likely capturing the majority of new patient searches in your area`
                : "Nearby clinics may be capturing the majority of new patient searches"}
            </div>
            <div style={{ fontSize: 12, color: "#6B7B78", lineHeight: 1.5 }}>
              Unlock the map to see exactly who is outranking you and where patients are going instead.
            </div>
          </div>
          <button
            onClick={() => onUpgrade?.()}
            style={{ background: "#1ABC9C", color: "#000", border: "none", padding: "11px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, boxShadow: "0 2px 12px rgba(26,188,156,0.25)" }}
          >
            Unlock Competitor Map →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD CONTENT ────────────────────────────────────────────────────────
function DashboardContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || "";
  const nameParam = searchParams.get("name") || "";
  const cityParam = searchParams.get("city") || "";
  const hasWebsite = !!url;
  const city = cityParam;
  const emailParam = searchParams.get("email") || "";

  // ── AUTH STATE ──────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "enter-email" | "enter-otp">("checking");
  const [authEmail, setAuthEmail] = useState(""); // real email for OTP calls
  const [authEmailDisplay, setAuthEmailDisplay] = useState(""); // masked email for display
  const [authOtp, setAuthOtp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "competitors" | "roadmap" | "reviews" | "score" | "health" | "map"
  >("competitors");
  const [competitorPage, setCompetitorPage] = useState(0);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [patientValue, setPatientValue] = useState(150);
  const [reviewContact, setReviewContact] = useState("");
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewPlatform, setReviewPlatform] = useState<"google" | "yelp" | "both">("google");
  const isValidContact = (v: string) => {
    const val = v.trim();
    if (val.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    return /^\+?[1-9]\d{9,14}$/.test(val.replace(/[\s\-().]/g, ""));
  };

  // Soft email capture banner (anonymous users)
  const [showSaveBanner, setShowSaveBanner] = useState(false);
  const [showExitIntent, setShowExitIntent] = useState(false);
  const [exitIntentDone, setExitIntentDone] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [bannerEmail, setBannerEmail] = useState("");
  const [bannerSent, setBannerSent] = useState(false);

  // Plan state
  const [isPro, setIsPro] = useState(false);
  const [isGrowth, setIsGrowth] = useState(false);
  const [teaserDismissed, setTeaserDismissed] = useState(false);

  // Post-payment unlock animation
  const [showUnlockAnim, setShowUnlockAnim] = useState(false);

  // Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Navigation UX
  const [compactHero, setCompactHero] = useState(false);
  const [tabFlash, setTabFlash] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const displayCity = city || data?.city || "";

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

  // ── AUTH LOGIC ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let bannerTimer: ReturnType<typeof setTimeout>;
    const init = async () => {
      // Cold email link — has email param, skip OTP entirely
      if (emailParam) {
        localStorage.setItem("rc_user_email", emailParam.toLowerCase().trim());
        localStorage.setItem("rc_auth_time", Date.now().toString());
        setAuthState("authenticated");
        return;
      }
      // Check existing Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setAuthState("authenticated");
        return;
      }
      // Known email in localStorage — check if verified within last 7 days
      const saved = localStorage.getItem("rc_user_email");
      const lastAuth = localStorage.getItem("rc_auth_time");
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (saved && lastAuth && Date.now() - parseInt(lastAuth) < sevenDays) {
        setAuthState("authenticated");
        return;
      }
      // Email known but session expired — auto-send OTP
      if (saved) {
        setAuthEmail(saved);
        setAuthEmailDisplay(saved[0] + "***@" + saved.split("@")[1]);
        setAuthState("enter-otp");
        await supabase.auth.signInWithOtp({ email: saved, options: { shouldCreateUser: true, emailRedirectTo: undefined } });
        return;
      }
      // Check leads table by URL — send OTP if found
      if (url) {
        const res = await fetch(`/api/lookup-user?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.found) {
          setAuthEmail(data.email);
          setAuthEmailDisplay(data.maskedEmail);
          setAuthState("enter-otp");
          return;
        }
      }
      // Anonymous user — load dashboard freely, show save banner after 60s
      setAuthState("authenticated");
      bannerTimer = setTimeout(() => setShowSaveBanner(true), 30000);
    };
    init();
    return () => clearTimeout(bannerTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitBannerEmail = async () => {
    if (!bannerEmail.includes("@")) return;
    const email = bannerEmail.toLowerCase().trim();
    localStorage.setItem("rc_user_email", email);
    localStorage.setItem("rc_auth_time", Date.now().toString());
    const { error: dbError } = await supabase.from("leads").insert({ email, url: url || null });
    if (dbError) console.error("Leads DB error:", dbError);
    setBannerSent(true);
  };

  const sendOtp = async () => {
    if (!authEmail.trim()) return;
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.toLowerCase().trim(),
      options: { shouldCreateUser: true, emailRedirectTo: undefined },
    });
    setAuthLoading(false);
    if (error) { setAuthError("Failed to send code. Try again."); return; }
    setAuthState("enter-otp");
  };

  const verifyOtp = async () => {
    if (!authOtp.trim()) return;
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.verifyOtp({
      email: authEmail.toLowerCase().trim(),
      token: authOtp.trim(),
      type: "email",
    });
    setAuthLoading(false);
    if (error) { setAuthError("Invalid or expired code. Try again."); return; }
    localStorage.setItem("rc_user_email", authEmail.toLowerCase().trim());
    localStorage.setItem("rc_auth_time", Date.now().toString());
    setAuthState("authenticated");
  };

  const submitExitIntent = async (answer: string) => {
    setShowExitIntent(false);
    const { error } = await supabase.from("feedback").insert({
      type: "exit_intent",
      message: answer,
      clinic_url: url || null,
      created_at: new Date().toISOString(),
    });
    if (error) console.error("Exit intent feedback error:", error);
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    const { error } = await supabase.from("feedback").insert({
      type: "manual",
      message: feedbackText.trim(),
      clinic_url: url || null,
      created_at: new Date().toISOString(),
    });
    if (error) { console.error("Feedback error:", error); return; }
    setFeedbackText("");
    setFeedbackSent(true);
    setTimeout(() => { setFeedbackSent(false); setShowFeedbackModal(false); }, 2000);
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
    if (!url && !nameParam) { setLoading(false); return; }
    const totalSteps = 8;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < totalSteps - 1) setLoadingStep(i);
      else clearInterval(interval);
    }, 2200);
    const minLoadTime = new Promise((r) => setTimeout(r, 5000));
    const auditQuery = hasWebsite
      ? `/api/audit?url=${encodeURIComponent(url)}`
      : `/api/audit?name=${encodeURIComponent(nameParam)}&city=${encodeURIComponent(city)}`;
    fetch(auditQuery)
      .then((res) => res.json())
      .then(async (d) => {
        await minLoadTime;
        clearInterval(interval);
        setLoadingStep(totalSteps - 1);
        await new Promise((r) => setTimeout(r, 400));
        if (d.error === "not_dental") {
          setError(d.message);
          setLoading(false);
          return;
        }
        setData(d);
        setLoading(false);
        setReviewsLoading(true);
        fetch(
          `/api/reviews?url=${encodeURIComponent(url)}&city=${encodeURIComponent(city)}&name=${encodeURIComponent(d.clinicName || nameParam)}&plan=${isGrowth ? "growth" : isPro ? "pro" : "free"}`,
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
  }, [url, nameParam, city]);

  // Compact hero + scroll listener
  useEffect(() => {
    const onScroll = () => setCompactHero(window.scrollY > 180);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Navigate tab with smooth scroll + section flash
  type TabId = "competitors" | "roadmap" | "reviews" | "score" | "health" | "map";
  function navigateToTab(id: TabId) {
    setActiveTab(id);
    setTabFlash(false);
    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      const heroH = heroRef.current?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - 72 - heroH;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      setTimeout(() => {
        setTabFlash(true);
        setTimeout(() => setTabFlash(false), 800);
      }, 350);
    });
  }

  // Exit intent — desktop mouse leave + mobile back button
  useEffect(() => {
    if (exitIntentDone || loading) return;
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && !exitIntentDone) {
        setShowExitIntent(true);
        setExitIntentDone(true);
      }
    };
    // Mobile: push a history state and detect back
    if (typeof window !== "undefined") {
      window.history.pushState({ exitIntent: true }, "");
      const handlePopState = () => {
        if (!exitIntentDone) {
          setShowExitIntent(true);
          setExitIntentDone(true);
        }
      };
      window.addEventListener("popstate", handlePopState);
      document.addEventListener("mouseleave", handleMouseLeave);
      return () => {
        document.removeEventListener("mouseleave", handleMouseLeave);
        window.removeEventListener("popstate", handlePopState);
      };
    }
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [exitIntentDone, loading]);

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
    { label: "Analysing how your clinic appears in local patient searches…" },
    { label: "Evaluating factors that influence patient discovery and booking decisions…" },
    { label: `Identifying nearby clinics currently attracting patient attention in ${displayCity || "your area"}…` },
    { label: "Understanding what influences patients when choosing between nearby clinics…" },
    { label: "Detecting patterns in patient feedback that may influence trust and referrals…" },
    { label: "Comparing how easily patients can discover your clinic versus nearby competitors…" },
    { label: "Preparing recommendations to improve your local visibility…" },
    { label: "Preparing your visibility summary…" },
  ];

  // ── AUTH SCREENS ────────────────────────────────────────────────────────────
  if (authState === "checking") return null;

  if (authState === "enter-email" || authState === "enter-otp") {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0F0E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: "#151918", border: "1px solid #2A3330", borderRadius: 16, padding: "48px 40px", width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#F7F3ED", marginBottom: 8 }}>
            Root<span style={{ color: "#C0392B" }}>Canal</span>
          </div>
          {authState === "enter-email" ? (
            <>
              <p style={{ color: "#6B7B78", fontSize: 14, marginBottom: 28, marginTop: 8 }}>Enter your email to access your report</p>
              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendOtp()}
                placeholder="your@email.com"
                autoFocus
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #2A3330", background: "#0D0F0E", color: "#F7F3ED", fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
              />
              {authError && <div style={{ color: "#E74C3C", fontSize: 13, marginBottom: 12 }}>{authError}</div>}
              <button
                onClick={sendOtp}
                disabled={authLoading || !authEmail.includes("@")}
                style={{ width: "100%", padding: "13px", borderRadius: 8, background: "#1ABC9C", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: authLoading || !authEmail.includes("@") ? 0.5 : 1 }}
              >
                {authLoading ? "Sending..." : "Send Code →"}
              </button>
            </>
          ) : (
            <>
              <p style={{ color: "#6B7B78", fontSize: 14, marginBottom: 4, marginTop: 8 }}>We sent a 6-digit code to</p>
              <p style={{ color: "#F7F3ED", fontSize: 14, marginBottom: 28 }}>{authEmailDisplay || authEmail}</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    autoFocus={i === 0}
                    value={authOtp[i] || ""}
                    placeholder="🦷"
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "");
                      const arr = authOtp.split("");
                      arr[i] = val;
                      const next = arr.join("").slice(0, 6);
                      setAuthOtp(next);
                      if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
                    }}
                    onKeyDown={e => {
                      if (e.key === "Backspace" && !authOtp[i] && i > 0) document.getElementById(`otp-${i - 1}`)?.focus();
                      if (e.key === "Enter") verifyOtp();
                    }}
                    style={{ width: 44, height: 52, borderRadius: 10, border: `1px solid ${authOtp[i] ? "#1ABC9C" : "#2A3330"}`, background: "#0D0F0E", color: "#F7F3ED", fontSize: authOtp[i] ? 22 : 18, textAlign: "center", outline: "none", fontFamily: "'DM Sans', sans-serif" }}
                  />
                ))}
              </div>
              {authError && <div style={{ color: "#E74C3C", fontSize: 13, marginBottom: 12 }}>{authError}</div>}
              <button
                onClick={verifyOtp}
                disabled={authLoading || authOtp.length < 6}
                style={{ width: "100%", padding: "13px", borderRadius: 8, background: "#1ABC9C", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: authLoading || authOtp.length < 6 ? 0.5 : 1 }}
              >
                {authLoading ? "Verifying..." : "Verify →"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div style={{ minHeight: "100vh", background: "#0D0F0E", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "0 16px" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
          @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
          @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
        `}</style>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#F7F3ED", marginBottom: 6 }}>
            Root<span style={{ color: "#C0392B" }}>Canal</span>
          </div>
          <div style={{ fontSize: 13, color: "#4A5E58" }}>{url}</div>
        </div>

        {/* Loading card */}
        <div style={{ width: "100%", maxWidth: 480, background: "#151918", border: "1px solid #2A3330", borderRadius: 16, padding: "28px 28px 24px" }}>
          {/* Contextual headline */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "rgba(240,235,227,0.7)", lineHeight: 1.4 }}>
              We&apos;re analysing how patients discover your clinic online.
            </div>
          </div>

          {/* Steps */}
          <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {loadingSteps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, width: "100%", maxWidth: 360, opacity: i <= loadingStep ? 1 : 0.2, animation: i <= loadingStep ? `fadeSlideUp 0.3s ease both` : "none" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: i < loadingStep ? "#1ABC9C" : "transparent", border: i < loadingStep ? "none" : `2px solid ${i === loadingStep ? "#1ABC9C" : "#2A3330"}` }}>
                  {i < loadingStep
                    ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : i === loadingStep
                    ? <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1ABC9C", animation: "blink 1.2s step-end infinite" }} />
                    : null}
                </div>
                <span style={{ fontSize: 13, fontWeight: i === loadingStep ? 500 : 400, color: i < loadingStep ? "#4A7A6A" : i === loadingStep ? "#F0EBE3" : "#2A3330" }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "#1E2A27", borderRadius: 99 }}>
            <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #1ABC9C, #2ECC71)", width: `${((loadingStep + 1) / loadingSteps.length) * 100}%`, transition: "width 0.8s ease" }} />
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#3A5349", textAlign: "center" }}>
            {loadingStep >= loadingSteps.length - 1
              ? "Visibility analysis ready"
              : `${Math.round(((loadingStep + 1) / loadingSteps.length) * 100)}%`}
          </div>
        </div>

        {/* Reassurance microcopy */}
        <div style={{ marginTop: 16, fontSize: 12, color: "#3A4A47", textAlign: "center", maxWidth: 380, lineHeight: 1.6 }}>
          This analysis typically takes a few seconds and helps identify practical growth opportunities.
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

  const userRank = data.userRank ?? (data.competitors.length > 0 ? data.competitors.length + 1 : undefined);
  // smoothedRank stabilises display across fluctuating raw samples; falls back to userRank
  const displayRank = data.smoothedRank ?? userRank;

  // competitionIntensity — derived from smoothed ahead count, not raw snapshot
  const smoothedAheadCount = displayRank != null ? Math.max(0, displayRank - 1) : null;
  const competitionIntensity = (() => {
    if (smoothedAheadCount == null) return null;
    if (smoothedAheadCount <= 3)  return { label: "Low Competition",       bg: "rgba(46,204,113,0.1)",  color: "#2ECC71" };
    if (smoothedAheadCount <= 8)  return { label: "Moderate Competition",  bg: "rgba(52,152,219,0.1)",  color: "#5DADE2" };
    if (smoothedAheadCount <= 15) return { label: "High Competition",      bg: "rgba(240,165,0,0.1)",   color: "#D4A843" };
    return                               { label: "Very High Competition", bg: "rgba(180,90,70,0.1)",   color: "#C07860" };
  })();

  const reviewRank = (() => {
    if (data.userReviewCount == null || data.competitors.length === 0) return undefined;
    const allReviews = [...data.competitors.map((c) => c.reviews), data.userReviewCount];
    allReviews.sort((a, b) => b - a);
    return allReviews.indexOf(data.userReviewCount) + 1;
  })();

  // ── TEASER SCREEN ────────────────────────────────────────────────────────────
  const showTeaser = !teaserDismissed && !isPro && !isGrowth;
  if (showTeaser) {
    const tRank = userRank;
    const [lostLow, lostHigh] = tRank == null || tRank > 20 ? [25, 40] : tRank > 10 ? [15, 25] : tRank > 5 ? [8, 15] : [3, 8];
    const topComp = data.competitors.length > 0 ? [...data.competitors].sort((a, b) => a.googleRank - b.googleRank)[0] : null;
    const reviewGapVsTop = topComp != null ? Math.max(0, (topComp.reviews || 0) - (data.userReviewCount || 0)) : null;
    const clinicLabel = data.clinicName || nameParam || "Your Clinic";

    return (
      <div style={{ minHeight: "100vh", background: "#0D0F0E", color: "#F0EBE3", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          * { box-sizing: border-box; }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          .teaser-card { animation: fadeUp 0.45s ease both; }
        `}</style>

        {/* Logo */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, marginBottom: 40, color: "#F0EBE3" }}>
          Root<span style={{ color: "#1ABC9C" }}>Canal</span>
        </div>

        <div className="teaser-card" style={{ width: "100%", maxWidth: 520 }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⭐</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#F0EBE3", lineHeight: 1.25, marginBottom: 8 }}>
              {clinicLabel}
            </div>
            <div style={{ fontSize: 14, color: "rgba(240,235,227,0.45)" }}>
              We analysed how patients see your clinic on Google.
            </div>
          </div>

          {/* 3 stat cards */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, marginBottom: 28 }}>

            {/* Rank */}
            <div style={{ background: "#151918", border: `1px solid ${tRank == null || tRank > 3 ? "rgba(231,76,60,0.3)" : "rgba(46,204,113,0.3)"}`, borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#6B7B78", textTransform: "uppercase" as const, letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>Google Rank</div>
                <div style={{ fontSize: 13, color: "rgba(240,235,227,0.5)", lineHeight: 1.5 }}>
                  {tRank == null || tRank > 3
                    ? "Top 3 clinics capture ~70% of patient clicks. Yours isn't there yet."
                    : "Strong position — protect it by staying ahead on reviews."}
                </div>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 900, color: tRank == null || tRank > 3 ? "#E74C3C" : "#1ABC9C", lineHeight: 1, flexShrink: 0, marginLeft: 20 }}>
                {tRank != null ? `#${tRank}` : "—"}
              </div>
            </div>

            {/* Lost patients */}
            <div style={{ background: "#151918", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#6B7B78", textTransform: "uppercase" as const, letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>Patients Lost to Competitors / Month</div>
                <div style={{ fontSize: 11, color: "rgba(240,235,227,0.28)", marginTop: 4, fontStyle: "italic" as const }}>
                  Visibility-based estimate from local search patterns
                </div>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 900, color: "#E74C3C", lineHeight: 1, flexShrink: 0, marginLeft: 20, whiteSpace: "nowrap" as const }}>
                {lostLow}–{lostHigh}
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(231,76,60,0.6)", marginLeft: 4 }}>/mo</span>
              </div>
            </div>

            {/* Review gap */}
            <div style={{ background: "#151918", border: "1px solid rgba(240,165,0,0.25)", borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#6B7B78", textTransform: "uppercase" as const, letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>Review Gap vs #1</div>
                <div style={{ fontSize: 13, color: "rgba(240,235,227,0.5)", lineHeight: 1.5 }}>
                  {reviewGapVsTop != null && reviewGapVsTop > 0
                    ? `${topComp?.name || "Top competitor"} has ${reviewGapVsTop} more reviews — that gap is costing you rank.`
                    : "You're competitive on reviews — focus on holding this advantage."}
                </div>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 900, color: "#F0A500", lineHeight: 1, flexShrink: 0, marginLeft: 20 }}>
                {reviewGapVsTop != null ? (reviewGapVsTop > 0 ? `+${reviewGapVsTop}` : "0") : "—"}
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <button
            onClick={() => { setTeaserDismissed(true); setShowUpgradeModal(true); }}
            style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #1ABC9C, #16a085)", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, color: "#000", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 24px rgba(26,188,156,0.35)", marginBottom: 14 }}
          >
            Unlock Full Growth Plan →
          </button>

          {/* Secondary dismiss */}
          <button
            onClick={() => setTeaserDismissed(true)}
            style={{ display: "block", width: "100%", background: "none", border: "none", color: "#4A5A57", fontSize: 13, cursor: "pointer", textAlign: "center" as const, padding: "8px" }}
          >
            View free report →
          </button>
        </div>
      </div>
    );
  }

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
        @keyframes modalEnter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sectionGlow { 0% { box-shadow: 0 0 0 0 rgba(26,188,156,0); } 30% { box-shadow: 0 0 0 2px rgba(26,188,156,0.28), inset 0 0 24px rgba(26,188,156,0.04); } 100% { box-shadow: 0 0 0 0 rgba(26,188,156,0); } }
        @keyframes tabUnderline { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes progressFill { from { width: 0%; } to { width: var(--pw, 12%); } }
        .card { animation: fadeUp 0.5s ease both; }
        .rc-section-flash { animation: sectionGlow 0.8s ease-out forwards !important; }
        .rc-hero-sticky { position: sticky; top: 65px; z-index: 20; transition: padding 0.25s ease, box-shadow 0.25s ease; }
        .rc-hero-compact .rc-hero-card { padding: 14px 20px !important; }
        .rc-hero-compact .rc-hero-number { font-size: 42px !important; line-height: 1 !important; }
        .rc-hero-compact .rc-hero-microcopy { display: none !important; }
        .rc-hero-compact .rc-hero-desc { display: none !important; }
        .rc-hero-compact .rc-hero-revenue { display: none !important; }
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
          .rc-hero-sticky { top: 56px !important; }
          .rc-hero-compact .rc-hero-card { padding: 12px 16px !important; }
          .rc-hero-compact .rc-hero-number { font-size: 34px !important; }
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
          .rc-main { padding: 16px 12px 80px !important; }
          nav { padding: 12px 16px !important; }
          .rc-upgrade-grid { grid-template-columns: 1fr !important; }
          .rc-upgrade-btns { flex-direction: column !important; align-items: stretch !important; }
          .rc-gap-grid { grid-template-columns: 1fr !important; }
          .rc-gap-vs { display: none !important; }
          .rc-roadmap-item { flex-wrap: wrap !important; }
          .rc-sidebar { display: none !important; }
          .rc-bottom-tabs { display: flex !important; }
          /* How it works pipeline */
          .rc-how-it-works { flex-wrap: wrap !important; justify-content: center !important; gap: 8px !important; }
          .rc-how-it-works-step { flex: none !important; width: calc(33% - 8px) !important; min-width: 90px !important; }
          .rc-how-it-works-arrow { display: none !important; }
          /* Competitors table → card rows */
          .rc-comp-table-header { display: none !important; }
          .rc-comp-row-grid { grid-template-columns: 1fr 1fr !important; row-gap: 4px !important; }
          /* Growth upsell banner */
          .rc-growth-banner { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; }
          /* Save banner */
          .rc-save-banner { flex-wrap: wrap !important; padding: 12px 16px 72px !important; gap: 8px !important; }
          .rc-save-banner input { flex: 1 1 100% !important; width: 100% !important; box-sizing: border-box !important; }
          .rc-save-banner .rc-save-btn { flex: 1 !important; }
          /* Upgrade modal */
          .rc-upgrade-modal { padding: 24px 16px !important; }
          /* Map */
          .rc-map-wrap { height: 260px !important; }
        }
        @media (max-width: 480px) {
          .rc-metric-grid { grid-template-columns: 1fr !important; }
          h1 { font-size: 22px !important; }
          .rc-how-it-works-step { width: calc(50% - 8px) !important; }
          .rc-comp-row-grid { grid-template-columns: 1fr !important; }
          nav .rc-upgrade-btn { font-size: 12px !important; padding: 8px 12px !important; }
        }
        .rc-sidebar-btn:hover { background: rgba(26,188,156,0.08) !important; color: #F0EBE3 !important; }
        .rc-bottom-tabs { display: none; }
        .rc-bottom-tab-btn:hover { background: rgba(26,188,156,0.08) !important; }
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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
          <a
            href="/"
            style={{
              fontSize: 12,
              color: "#4A5A57",
              textDecoration: "none",
              fontFamily: "'DM Sans', sans-serif",
              border: "1px solid #2A3330",
              borderRadius: 6,
              padding: "3px 8px",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget).style.color = "#6B7B78"; (e.currentTarget).style.borderColor = "#3A4A47"; }}
            onMouseLeave={e => { (e.currentTarget).style.color = "#4A5A57"; (e.currentTarget).style.borderColor = "#2A3330"; }}
          >
            ← Home
          </a>
        </div>
        <div
          className="rc-nav-url"
          style={{
            fontSize: 13,
            color: "#6B7B78",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {url} · {displayCity}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {!isPro && !isGrowth && (
            <a
              href="https://calendly.com/hello-rootcanal/30min"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #2A3330",
                background: "transparent",
                color: "#6B7B78",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#1ABC9C"; e.currentTarget.style.color = "#1ABC9C"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#2A3330"; e.currentTarget.style.color = "#6B7B78"; }}
            >
              📅 Book a Demo
            </a>
          )}
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
                Get More Patient Bookings →
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
              Unlock Patients You're Losing →
            </button>
          )}
        </div>
      </nav>

      {/* BODY */}
      <div style={{ display: "flex", maxWidth: 1280, margin: "0 auto" }}>

        {/* SIDEBAR */}
        <aside className="rc-sidebar" style={{
          width: 210,
          flexShrink: 0,
          borderRight: "1px solid #2A3330",
          padding: "28px 0",
          position: "sticky",
          top: 65,
          height: "calc(100vh - 65px)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ padding: "0 20px 16px", fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: "#4A5A57", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
            Navigation
          </div>
          {([
            { id: "roadmap",     label: "📈 Growth Plan",    freeVisible: true },
            { id: "reviews",     label: "⭐ Reviews (G+Y)",  freeVisible: true },
            { id: "competitors", label: "🏆 Competitors",    freeVisible: true },
            { id: "map",         label: "🗺️ Map",            freeVisible: false },
            { id: "score",       label: "🧠 Intelligence",   freeVisible: false },
            ...(hasWebsite ? [{ id: "health" as const, label: "🔧 Health", freeVisible: false }] : []),
          ] as const).filter(item => (isPro || isGrowth) || item.freeVisible).map((item) => (
            <button
              key={item.id}
              onClick={() => navigateToTab(item.id)}
              className="rc-sidebar-btn"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "11px 20px",
                border: "none",
                cursor: "pointer",
                background: activeTab === item.id ? "rgba(26,188,156,0.1)" : "transparent",
                color: activeTab === item.id ? "#1ABC9C" : "#6B7B78",
                fontSize: 14,
                fontWeight: activeTab === item.id ? 700 : 500,
                fontFamily: "'DM Sans', sans-serif",
                borderLeft: activeTab === item.id ? "3px solid #1ABC9C" : "3px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {item.label}
            </button>
          ))}

          {/* GIVE FEEDBACK */}
          <div style={{ padding: "0 12px 8px", marginTop: "auto" }}>
            <button
              onClick={() => setShowFeedbackModal(true)}
              style={{
                width: "100%", padding: "8px 12px", background: "transparent",
                border: "1px solid #2A3330", borderRadius: 8, color: "#4A5A57",
                fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                textAlign: "left", transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = "#6B7B78"; (e.target as HTMLButtonElement).style.borderColor = "#3A4A47"; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = "#4A5A57"; (e.target as HTMLButtonElement).style.borderColor = "#2A3330"; }}
            >
              💬 Give Feedback
            </button>
          </div>

          {/* SIDEBAR FEATURE BLOCK */}
          <div style={{ padding: "0 12px 12px" }}>
            {isGrowth ? (
              <div style={{ background: "rgba(26,188,156,0.06)", border: "1px solid rgba(26,188,156,0.15)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1ABC9C", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>🚀 Growth Active</div>
                <div style={{ fontSize: 11, color: "#6B7B78", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>All features unlocked. Your clinic is on the path to #1.</div>
              </div>
            ) : (
              <div style={{
                background: isPro ? "linear-gradient(135deg, #2a1f0a, #1f1500)" : "linear-gradient(135deg, #0f2a20, #0D1F18)",
                border: isPro ? "1px solid rgba(212,168,67,0.25)" : "1px solid rgba(26,188,156,0.25)",
                borderRadius: 12,
                padding: "14px 12px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isPro ? "#D4A843" : "#1ABC9C", marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>
                  {isPro ? "Move to #1 Faster" : "Recover Lost Patients"}
                </div>
                <div style={{ fontSize: 10, color: "#4A5A57", marginBottom: 10, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                  {isPro ? "Accelerate to #1 faster" : "to nearby competitors."}
                </div>
                {(isPro ? [
                  { icon: "🛠️", title: "Done-For-You Fixes" },
                  { icon: "📅", title: "Weekly Updates" },
                  { icon: "👤", title: "Dedicated Manager" },
                  { icon: "🔔", title: "Competitor Alerts" },
                ] : [
                  { icon: "⭐", title: "Get More Reviews" },
                  { icon: "📈", title: "Monthly Progress" },
                  { icon: "🔔", title: "Competitor Alerts" },
                  { icon: "💬", title: "Review Monitoring" },
                  { icon: "🛠️", title: "Fix Guides" },
                  { icon: "🏆", title: "Rank Tracking" },
                ]).map((f) => (
                  <div key={f.title} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: "#0D0F0E",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13,
                    }}>{f.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#B0BDB9" }}>{f.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* MAIN */}
        <div
          className="rc-main"
          style={{ flex: 1, padding: "32px 40px", minWidth: 0 }}
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
              (nameParam
                ? nameParam
                : url
                ? url
                    .replace(/https?:\/\//, "")
                    .replace(/^www\./, "")
                    .split("/")[0]
                    .replace(/\.(com|net|org|io|us|dental|care|health)$/, "")
                    .replace(/[-_.]/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())
                    .trim()
                : "Your Clinic")}
 — Competitive Dashboard
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
              📡 Powered by Google Maps, Yelp, Google PageSpeed & live web data
            </span>
          </div>
        </div>

        {/* ── PATIENT LOSS HERO CARD ───────────────────────── */}
        <div ref={heroRef} className={`rc-hero-sticky${compactHero ? " rc-hero-compact" : ""}`}>
        {(userRank == null || userRank > 3) && (() => {
          const [lostLow, lostHigh] = userRank == null || userRank > 20
            ? [25, 40]
            : userRank > 10
            ? [15, 25]
            : userRank > 5
            ? [8, 15]
            : [3, 8];
          const revLow  = lostLow  * patientValue;
          const revHigh = lostHigh * patientValue;
          const fmt = (n: number) => "$" + n.toLocaleString();
          return (
            <div className="card rc-hero-card" style={{
              background: "linear-gradient(135deg, #1a0a0a 0%, #200d00 50%, #0d1a14 100%)",
              border: "1px solid rgba(231,76,60,0.35)",
              borderRadius: 16,
              padding: "28px 32px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap" as const,
              position: "relative" as const,
              overflow: "hidden",
              boxShadow: compactHero ? "0 4px 24px rgba(0,0,0,0.5)" : "none",
              transition: "padding 0.25s ease, box-shadow 0.25s ease",
            }}>
              {/* Glow accent */}
              <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(231,76,60,0.08)", pointerEvents: "none" }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase" as const, color: "#E74C3C", fontWeight: 700, marginBottom: 10 }}>
                  ⚠ Patients Lost to Competitors
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" as const }}>
                  <span className="rc-hero-number" style={{ fontFamily: "'Playfair Display', serif", fontSize: 56, fontWeight: 900, color: "#E74C3C", lineHeight: 1, transition: "font-size 0.25s ease" }}>
                    {lostLow}–{lostHigh}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(240,235,227,0.6)" }}>patients / month</span>
                </div>
                <div className="rc-hero-microcopy" style={{ fontSize: 11, color: "rgba(240,235,227,0.3)", marginBottom: 12, fontStyle: "italic" as const }}>
                  Visibility-based estimate from local search patterns
                </div>
                <div className="rc-hero-desc" style={{ fontSize: 13, color: "rgba(240,235,227,0.5)", marginBottom: 8, lineHeight: 1.5 }}>
                  Many patients searching nearby are likely choosing higher-ranked clinics before reaching yours.
                </div>
                <div className="rc-hero-revenue" style={{ fontSize: 13, color: "rgba(240,235,227,0.35)", marginBottom: 4 }}>
                  Potential revenue opportunity:{" "}
                  <span style={{ color: "#F0A500", fontWeight: 700 }}>{fmt(revLow)}–{fmt(revHigh)} / month</span>
                  <span style={{ fontSize: 11, color: "rgba(240,235,227,0.2)", marginLeft: 6 }}>based on avg. patient value of ${patientValue}</span>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  style={{
                    background: "linear-gradient(135deg, #1ABC9C, #16a085)",
                    border: "none",
                    borderRadius: 10,
                    padding: "14px 24px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#000",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: "nowrap" as const,
                    boxShadow: "0 4px 20px rgba(26,188,156,0.3)",
                  }}
                >
                  Unlock Growth Plan →
                </button>
              </div>
            </div>
          );
        })()}
        </div>{/* /rc-hero-sticky */}

        {/* ── FASTEST WAY HERO ─────────────────────────────── */}
        {data.placeId && activeTab !== "reviews" && (
          <div style={{
            background: "linear-gradient(135deg, #081a12 0%, #0a2018 60%, #0d1a14 100%)",
            border: "1px solid rgba(26,188,156,0.3)",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 24,
            position: "relative" as const,
            overflow: "hidden",
          }}>
            {/* Subtle glow */}
            <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(26,188,156,0.06)", pointerEvents: "none" }} />

            <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase" as const, color: "#1ABC9C", fontWeight: 700, marginBottom: 8 }}>
              ⚡ Action — Do This Now
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "#F0EBE3", marginBottom: 4 }}>
              Fastest Way to Get More Patients This Week
            </div>
            <div style={{ fontSize: 13, color: "rgba(240,235,227,0.45)", marginBottom: 20, lineHeight: 1.5 }}>
              Send a review link to one patient right now — each new review raises your local ranking and directly increases booking inquiries.
            </div>

            {reviewSent ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.25)", borderRadius: 10, padding: "14px 18px" }}>
                <span style={{ fontSize: 20 }}>🎉</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#2ECC71" }}>Review request sent!</div>
                  <div style={{ fontSize: 12, color: "#6B7B78", marginTop: 2 }}>Your patient will receive a direct Google review link. Send to another patient to keep the momentum.</div>
                </div>
                <button onClick={() => setReviewSent(false)} style={{ marginLeft: "auto", background: "none", border: "1px solid rgba(46,204,113,0.3)", borderRadius: 8, color: "#2ECC71", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                  Send Another →
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
                  <input
                    type="text"
                    placeholder="Patient email or phone number"
                    value={reviewContact}
                    onChange={e => { setReviewContact(e.target.value); setReviewError(""); }}
                    onKeyDown={async e => {
                      if (e.key !== "Enter" || !isValidContact(reviewContact) || !data.placeId) return;
                      setReviewSending(true); setReviewError("");
                      const isEmail = reviewContact.includes("@");
                      try {
                        const res = await fetch("/api/request-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact: reviewContact.trim(), type: isEmail ? "email" : "phone", clinicName: data.clinicName || nameParam, clinicUrl: data.url || "", placeId: data.placeId, platform: "google", yelpUrl: data.yelpUrl }) });
                        const result = await res.json();
                        if (result.success) { setReviewSent(true); setReviewContact(""); } else setReviewError("Failed to send. Try again.");
                      } catch { setReviewError("Something went wrong."); } finally { setReviewSending(false); }
                    }}
                    style={{ flex: 1, minWidth: 200, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(26,188,156,0.25)", borderRadius: 10, padding: "13px 16px", color: "#F0EBE3", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
                  />
                  <button
                    onClick={async () => {
                      if (!isValidContact(reviewContact) || !data.placeId) return;
                      setReviewSending(true); setReviewError("");
                      const isEmail = reviewContact.includes("@");
                      try {
                        const res = await fetch("/api/request-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact: reviewContact.trim(), type: isEmail ? "email" : "phone", clinicName: data.clinicName || nameParam, clinicUrl: data.url || "", placeId: data.placeId, platform: "google", yelpUrl: data.yelpUrl }) });
                        const result = await res.json();
                        if (result.success) { setReviewSent(true); setReviewContact(""); } else setReviewError("Failed to send. Try again.");
                      } catch { setReviewError("Something went wrong."); } finally { setReviewSending(false); }
                    }}
                    disabled={reviewSending}
                    style={{
                      background: isValidContact(reviewContact) ? "#1ABC9C" : "rgba(26,188,156,0.1)",
                      color: isValidContact(reviewContact) ? "#000" : "#1ABC9C",
                      border: isValidContact(reviewContact) ? "none" : "1px solid rgba(26,188,156,0.35)",
                      borderRadius: 10,
                      padding: "13px 22px",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: isValidContact(reviewContact) ? "pointer" : "default",
                      fontFamily: "'DM Sans', sans-serif",
                      whiteSpace: "nowrap" as const,
                      transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
                      boxShadow: isValidContact(reviewContact) ? "0 4px 18px rgba(26,188,156,0.35)" : "none",
                      flexShrink: 0,
                    }}
                  >
                    {reviewSending ? "Sending..." : "Send Review Request →"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "rgba(240,235,227,0.45)", paddingLeft: 2, lineHeight: 1.5 }}>
                  Takes ~2 seconds. Sends a direct Google review link — no setup needed.
                </div>
                {reviewError && <div style={{ fontSize: 12, color: "#E74C3C" }}>{reviewError}</div>}
              </div>
            )}
          </div>
        )}

        {/* ── COMPETITORS: rank strip ──────────────────────── */}
        {activeTab === "competitors" && (
          <div className="card" style={{ display: "flex", alignItems: "center", background: "#151918", border: "1px solid #2A3330", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderRight: "1px solid #2A3330", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: "#6B7B78", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google Rank
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: typeof displayRank === "number" && displayRank <= 3 ? "#1ABC9C" : "#E74C3C", lineHeight: 1 }}>{displayRank != null ? `#${displayRank}` : "—"}</div>
              <div style={{ fontSize: 11, color: "#6B7B78", marginTop: 4 }}>
                {data.rankRangeLow != null && data.rankRangeHigh != null && data.rankRangeLow !== data.rankRangeHigh
                  ? `range #${data.rankRangeLow}–#${data.rankRangeHigh}`
                  : "within 5 km"}
              </div>
            </div>
            {reviewRank != null && (
              <div style={{ padding: "14px 20px", borderRight: "1px solid #2A3330", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "#6B7B78", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Review Rank
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: reviewRank <= 3 ? "#1ABC9C" : "#E74C3C", lineHeight: 1 }}>#{reviewRank}</div>
                <div style={{ fontSize: 11, color: "#6B7B78", marginTop: 4 }}>by review count</div>
              </div>
            )}
            {data.yelpRank != null && (
              <div style={{ padding: "14px 20px", borderRight: "1px solid #2A3330", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "#6B7B78", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24"><path d="M21.111 18.226c-.141.969-2.119 3.483-3.029 3.847-.311.124-.623.094-.867-.09-.148-.11-.258-.24-2.458-3.699l-.633-1.013a.866.866 0 0 1 .171-1.078.875.875 0 0 1 1.084-.036l.658.476c2.262 1.639 2.393 1.734 2.541 1.843.276.204.586.181.849-.046.373-.319.38-.856.08-1.247a.858.858 0 0 1-.077-.1l-.009-.013c-.111-.18-3.089-5.033-3.089-5.033a.868.868 0 0 1 .259-1.191.869.869 0 0 1 1.201.231c.021.033 2.954 4.768 2.954 4.768l.006.009c.138.212.325.341.53.363.22.024.437-.07.599-.255.232-.265.248-.649.049-.934-.006-.007-.008-.014-.014-.021L12.673 5.11a.907.907 0 0 1 .104-1.202.912.912 0 0 1 1.221.02l7.064 7.432c.012.012.025.025.037.039 1.223 1.486 1.276 4.046.012 6.827zm-10.6 3.569c-.14.622-.777 1.069-1.617 1.153-.828.083-2.885-.241-4.516-.784-.869-.286-1.305-.738-1.275-1.306.019-.368.199-.665.511-.837l4.168-2.328a.866.866 0 0 1 1.182.318l1.41 2.513a.867.867 0 0 1 .137.471v.8zM9.64 13.48a.865.865 0 0 1-.618.765l-4.664 1.338a.876.876 0 0 1-1.07-.569C3.018 13.973 2.876 12.04 3.21 10.32c.193-.993.629-1.483 1.294-1.458.381.014.659.168.818.318l4.178 3.326a.864.864 0 0 1 .317.69l-.177.284zm-.516-5.913L4.7 9.714a.878.878 0 0 1-1.136-.329.867.867 0 0 1 .001-.875C4.42 7.246 6.137 5.58 7.286 4.84c.618-.398 1.152-.429 1.542-.089.234.204.336.479.314.801L9 8.808a.862.862 0 0 1-.876.759z" fill="#FF1A1A"/></svg>
                  Yelp Rank
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: data.yelpRank <= 3 ? "#1ABC9C" : "#E74C3C", lineHeight: 1 }}>#{data.yelpRank}</div>
                <div style={{ fontSize: 11, color: "#6B7B78", marginTop: 4 }}>on Yelp</div>
              </div>
            )}
            <div style={{ padding: "14px 24px", fontSize: 13, color: "#6B7B78", lineHeight: 1.6 }}>
              {typeof displayRank === "number" && reviewRank != null && displayRank <= 3 && reviewRank > displayRank
                ? `You rank #${displayRank} on Google but #${reviewRank} by reviews — clinics with more reviews are 3x more likely to steal your next booking.`
                : typeof displayRank === "number" && displayRank <= 3
                ? `You're ranked #${displayRank} nearby — top 3 clinics capture ~70% of patient clicks. Every review you collect protects that revenue.`
                : `📉 You're ranked #${displayRank} nearby. Top 3 clinics capture ~70% of patient clicks — patients at your rank rarely appear in new booking searches.`}
            </div>
          </div>
        )}

        {/* ── HEALTH: website metrics strip ────────────────── */}
        {activeTab === "health" && (
          <div className="card" style={{ display: "flex", alignItems: "center", background: "#151918", border: "1px solid #2A3330", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
            {([
              { icon: "⚡", value: data.performanceScore === 0 && data.seoScore === 0 ? "—" : data.performanceScore >= 80 ? "A" : data.performanceScore >= 60 ? "B" : data.performanceScore >= 40 ? "C" : "F", label: "Website Speed", sublabel: "slow sites can meaningfully reduce patient conversions", color: data.performanceScore >= 70 ? "#2ECC71" : data.performanceScore >= 40 ? "#F0A500" : "#E74C3C" },
              { icon: "🔍", value: data.performanceScore === 0 && data.seoScore === 0 ? "—" : data.seoScore >= 80 ? "A" : data.seoScore >= 60 ? "B" : data.seoScore >= 40 ? "C" : "F", label: "Google Findability", sublabel: "poor findability costs you new patient bookings daily", color: data.seoScore >= 70 ? "#2ECC71" : data.seoScore >= 40 ? "#F0A500" : "#E74C3C" },
              { icon: "👆", value: data.performanceScore === 0 && data.seoScore === 0 ? "—" : data.accessibilityScore >= 80 ? "A" : data.accessibilityScore >= 60 ? "B" : data.accessibilityScore >= 40 ? "C" : "F", label: "Website Usability", sublabel: "hard-to-use sites reduce form completions and enquiries", color: data.accessibilityScore >= 70 ? "#2ECC71" : "#F0A500" },
            ] as { icon: string; value: string | number; label: string; sublabel: string; color: string }[]).map((m, i, arr) => (
              <div key={i} style={{ flex: 1, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, borderRight: i < arr.length - 1 ? "1px solid #2A3330" : "none" }}>
                <span style={{ fontSize: 20 }}>{m.icon}</span>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: "#B0BDB9", marginTop: 2, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: "#4A5A57", marginTop: 1 }}>{m.sublabel}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── COMPETITORS TAB CONTENT ─────────────────────── */}
        {activeTab === "competitors" && (<>

        {/* NOT IN TOP 60 BANNER */}
        {userRank == null && (
          <div className="card" style={{ background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.35)", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <span style={{ fontSize: 28 }}>🚨</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E74C3C", marginBottom: 3 }}>Your practice doesn&apos;t appear in the top 60 Google results</div>
              <div style={{ fontSize: 12, color: "#6B7B78", lineHeight: 1.5 }}>Patients searching for a dentist nearby won&apos;t find you. Collecting more Google reviews is the fastest way to move up.</div>
            </div>
            {!isGrowth && (
              <button onClick={() => setShowUpgradeModal(true)} style={{ marginLeft: "auto", flexShrink: 0, background: "#E74C3C", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                Fix This →
              </button>
            )}
          </div>
        )}

        {/* RANK VISIBILITY BANNER */}
        {data.competitors.length > 0 && (() => {
          const inTopThree = (typeof userRank === "number" ? userRank : 8) <= 3;
          return (
            <div className="card" style={{
              background: inTopThree ? "rgba(46,204,113,0.08)" : "rgba(231,76,60,0.08)",
              border: `1px solid ${inTopThree ? "rgba(46,204,113,0.25)" : "rgba(231,76,60,0.25)"}`,
              borderRadius: 16,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>{inTopThree ? "🏆" : "📉"}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F0EBE3" }}>
                    {inTopThree ? `You're in the top 3 in ${displayCity} — for now.` : `You're outside the top 3 — most patients never scroll that far`}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7B78", marginTop: 2 }}>
                    {inTopThree ? "Rankings shift weekly. Clinics in top 3 that consistently collect reviews get 5x more inquiries — those that stop collecting reviews, drop." : "Top 3 clinics capture ~70% of all patient clicks and bookings. At your current rank, most new patients never see your clinic."}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                {inTopThree && !isGrowth && (
                  <button onClick={() => setShowUpgradeModal(true)} style={{ background: "#1ABC9C", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
                    Protect Your Rank →
                  </button>
                )}
                {!inTopThree && !isGrowth && (
                  <button onClick={() => setShowUpgradeModal(true)} style={{ background: "#E74C3C", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
                    Fix This Now →
                  </button>
                )}
                {!inTopThree && data.healthgradesFound === false && (
                  <div style={{ background: "rgba(231,76,60,0.12)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 8, padding: "8px 12px", textAlign: "left", maxWidth: 220 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#E74C3C" }}>⚠️ You are losing patients right now</div>
                    <div style={{ fontSize: 11, color: "#6B7B78", marginTop: 3 }}>Not in top 3 + invisible on Healthgrades = patients choosing your competitors daily.</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}


        {/* ── end competitors part 1 ── */}
        </>)}

        {/* ── REVIEWS TAB CONTENT ─────────────────────────── */}
        {activeTab === "reviews" && (<>

        {/* HERO REVIEW BLOCK */}
        <div
          className="card no-print"
          style={{
            background: "linear-gradient(135deg, #081a12 0%, #0a2018 60%, #0d1a14 100%)",
            border: "1px solid rgba(26,188,156,0.3)",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle glow */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(26,188,156,0.06)", pointerEvents: "none" }} />

          <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase" as const, color: "#1ABC9C", fontWeight: 700, marginBottom: 8 }}>
            ⚡ Action — Do This Now
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "#F0EBE3", marginBottom: 4 }}>
            Fastest Way to Get More Patients This Week
          </div>
          <div style={{ fontSize: 13, color: "rgba(240,235,227,0.45)", marginBottom: 20, lineHeight: 1.5 }}>
            Send a review link to one patient right now — each new review raises your local ranking and directly increases booking inquiries.
          </div>

          {reviewSent ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.25)", borderRadius: 10, padding: "14px 18px" }}>
              <span style={{ fontSize: 20 }}>🎉</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#2ECC71" }}>Review request sent!</div>
                <div style={{ fontSize: 12, color: "#6B7B78", marginTop: 2 }}>
                  Your patient will receive a direct {reviewPlatform === "both" ? "Google + Yelp review link" : reviewPlatform === "yelp" ? "Yelp review link" : "Google review link"}. Send to another to keep the momentum.
                </div>
              </div>
              <button onClick={() => setReviewSent(false)} style={{ marginLeft: "auto", background: "none", border: "1px solid rgba(46,204,113,0.3)", borderRadius: 8, color: "#2ECC71", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                Send Another →
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Platform selector */}
              {data.yelpUrl && (
                <div style={{ display: "inline-flex", background: "#0D1210", border: "1px solid #2A3330", borderRadius: 8, overflow: "hidden", alignSelf: "flex-start", marginBottom: 4 }}>
                  {(["google", "yelp", "both"] as const).map((p, i) => (
                    <button key={p} onClick={() => setReviewPlatform(p)} style={{ padding: "6px 14px", background: reviewPlatform === p ? "rgba(26,188,156,0.15)" : "transparent", color: reviewPlatform === p ? "#1ABC9C" : "#6B7B78", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", border: "none", borderLeft: i > 0 ? "1px solid #2A3330" : "none", display: "flex", alignItems: "center", gap: 5, transition: "background 0.15s, color 0.15s" }}>
                      {p === "google" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>}
                      {p === "yelp" && <svg width="10" height="10" viewBox="0 0 24 24"><path d="M21.111 18.226c-.141.969-2.119 3.483-3.029 3.847-.311.124-.623.094-.867-.09-.148-.11-.258-.24-2.458-3.699l-.633-1.013a.866.866 0 0 1 .171-1.078.875.875 0 0 1 1.084-.036l.658.476c2.262 1.639 2.393 1.734 2.541 1.843.276.204.586.181.849-.046.373-.319.38-.856.08-1.247a.858.858 0 0 1-.077-.1l-.009-.013c-.111-.18-3.089-5.033-3.089-5.033a.868.868 0 0 1 .259-1.191.869.869 0 0 1 1.201.231c.021.033 2.954 4.768 2.954 4.768l.006.009c.138.212.325.341.53.363.22.024.437-.07.599-.255.232-.265.248-.649.049-.934-.006-.007-.008-.014-.014-.021L12.673 5.11a.907.907 0 0 1 .104-1.202.912.912 0 0 1 1.221.02l7.064 7.432c.012.012.025.025.037.039 1.223 1.486 1.276 4.046.012 6.827zm-10.6 3.569c-.14.622-.777 1.069-1.617 1.153-.828.083-2.885-.241-4.516-.784-.869-.286-1.305-.738-1.275-1.306.019-.368.199-.665.511-.837l4.168-2.328a.866.866 0 0 1 1.182.318l1.41 2.513a.867.867 0 0 1 .137.471v.8zM9.64 13.48a.865.865 0 0 1-.618.765l-4.664 1.338a.876.876 0 0 1-1.07-.569C3.018 13.973 2.876 12.04 3.21 10.32c.193-.993.629-1.483 1.294-1.458.381.014.659.168.818.318l4.178 3.326a.864.864 0 0 1 .317.69l-.177.284zm-.516-5.913L4.7 9.714a.878.878 0 0 1-1.136-.329.867.867 0 0 1 .001-.875C4.42 7.246 6.137 5.58 7.286 4.84c.618-.398 1.152-.429 1.542-.089.234.204.336.479.314.801L9 8.808a.862.862 0 0 1-.876.759z" fill="#FF1A1A"/></svg>}
                      {p === "both" ? "Both" : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
                <input
                  type="text"
                  placeholder="Patient email or phone number"
                  value={reviewContact}
                  onChange={e => {
                    const val = e.target.value;
                    const isPhone = !val.includes("@") && /^[0-9\s\-+().]*$/.test(val);
                    if (isPhone && val.replace(/[\s\-().]/g, "").length > 16) return;
                    setReviewContact(val); setReviewError("");
                  }}
                  onKeyDown={async e => {
                    if (e.key !== "Enter" || !isValidContact(reviewContact) || !data.placeId) return;
                    setReviewSending(true); setReviewError("");
                    const isEmail = reviewContact.includes("@");
                    try {
                      const res = await fetch("/api/request-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact: reviewContact.trim(), type: isEmail ? "email" : "phone", clinicName: data.clinicName || nameParam, clinicUrl: data.url || "", placeId: data.placeId, platform: reviewPlatform, yelpUrl: data.yelpUrl }) });
                      const result = await res.json();
                      if (result.success) { setReviewSent(true); setReviewContact(""); } else setReviewError("Failed to send. Try again.");
                    } catch { setReviewError("Something went wrong."); } finally { setReviewSending(false); }
                  }}
                  style={{ flex: 1, minWidth: 200, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(26,188,156,0.25)", borderRadius: 10, padding: "13px 16px", color: "#F0EBE3", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
                />
                <button
                  onClick={async () => {
                    if (!isValidContact(reviewContact) || !data.placeId) return;
                    setReviewSending(true); setReviewError("");
                    const isEmail = reviewContact.includes("@");
                    try {
                      const res = await fetch("/api/request-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact: reviewContact.trim(), type: isEmail ? "email" : "phone", clinicName: data.clinicName || nameParam, clinicUrl: data.url || "", placeId: data.placeId, platform: reviewPlatform, yelpUrl: data.yelpUrl }) });
                      const result = await res.json();
                      if (result.success) { setReviewSent(true); setReviewContact(""); } else setReviewError("Failed to send. Try again.");
                    } catch { setReviewError("Something went wrong."); } finally { setReviewSending(false); }
                  }}
                  disabled={reviewSending}
                  style={{ background: isValidContact(reviewContact) ? "#1ABC9C" : "rgba(26,188,156,0.1)", color: isValidContact(reviewContact) ? "#000" : "#1ABC9C", border: isValidContact(reviewContact) ? "none" : "1px solid rgba(26,188,156,0.35)", borderRadius: 10, padding: "13px 22px", fontSize: 14, fontWeight: 700, cursor: isValidContact(reviewContact) ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" as const, transition: "background 0.18s, color 0.18s, box-shadow 0.18s", boxShadow: isValidContact(reviewContact) ? "0 4px 18px rgba(26,188,156,0.35)" : "none", flexShrink: 0 }}
                >
                  {reviewSending ? "Sending..." : "Send Review Request →"}
                </button>
              </div>
              <div style={{ fontSize: 12, color: "rgba(240,235,227,0.45)", paddingLeft: 2, lineHeight: 1.5 }}>
                Takes ~2 seconds. Sends a direct Google review link — no setup needed.
              </div>
              {reviewError && <div style={{ fontSize: 12, color: "#E74C3C" }}>{reviewError}</div>}
            </div>
          )}
        </div>

        {/* HOW IT WORKS PIPELINE */}
        <div style={{
          background: "linear-gradient(135deg, #0a1a14, #0D1F18)",
          border: "1px solid rgba(26,188,156,0.2)",
          borderRadius: 16,
          padding: "32px 36px",
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#1ABC9C", textTransform: "uppercase", marginBottom: 28 }}>
            How it works
          </div>
          <div className="rc-how-it-works" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            {[
              { emoji: "🦷", label: "Patient visits", sub: "your clinic" },
              { emoji: "📧", label: "You enter", sub: "patient email" },
              { emoji: "📩", label: "Patient gets", sub: "review link" },
              { emoji: "⭐", label: "Patient leaves", sub: "Google review" },
              { emoji: "🤖", label: "We auto-reply", sub: "on your behalf" },
              { emoji: "📈", label: "Ranking improves", sub: "you rise on Google" },
              { emoji: "🏥", label: "More patients", sub: "book your clinic" },
            ].map((step, i) => (
              <div key={i} className="rc-how-it-works-step" style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{
                  textAlign: "center",
                  flex: 1,
                  background: "rgba(26,188,156,0.06)",
                  border: "1px solid rgba(26,188,156,0.12)",
                  borderRadius: 14,
                  padding: "20px 8px",
                }}>
                  <div style={{ fontSize: 42, marginBottom: 10, lineHeight: 1 }}>{step.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#F0EBE3", marginBottom: 4 }}>{step.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(247,243,237,0.45)" }}>{step.sub}</div>
                </div>
                {i < 6 && (
                  <div className="rc-how-it-works-arrow" style={{ fontSize: 20, color: "#1ABC9C", padding: "0 8px", flexShrink: 0, marginBottom: 10 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* GROWTH UPSELL BANNER — pro users only */}
        {isPro && !isGrowth && (
          <div
            className="card rc-growth-banner"
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
                🚀 Ready to dominate {displayCity}?
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
              Start Winning Patients Back — $99/mo →
            </button>
          </div>
        )}

        {/* ── end reviews part 1 ── */}
        </>)}

        {/* ── COMPETITORS TAB — part 2 (top priorities) ─── */}
        {activeTab === "competitors" && (<>

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
              `Get ${Math.min(reviewGap, 20)} more Google reviews — consistent review growth is the fastest way to move up in local rankings`,
            );
          if (data.performanceScore > 0 && data.performanceScore < 60)
            priorities.push(
              `Speed up your website (${data.performanceScore}/100) — slow sites can meaningfully reduce patient conversions`,
            );
          if (reviews && reviews.responseRate < 70)
            priorities.push(
              `Respond to patient reviews — clinics that respond typically receive noticeably more booking enquiries`,
            );
          if (data.seoScore > 0 && data.seoScore < 70)
            priorities.push(
              `Improve Google findability (${data.seoScore}/100) — better SEO directly increases new patients finding you first`,
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

        {/* ── end competitors part 2 ── */}
        </>)}

        {/* BOTTOM TABS — mobile only */}
        <div
          className="rc-bottom-tabs"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            display: "none",
            gap: 0,
            background: "#0D1310",
            borderTop: "1px solid #2A3330",
            padding: "8px 4px",
          }}
        >
          {(
            [
              { id: "roadmap",     label: "📈", sublabel: "Growth",  freeVisible: true },
              { id: "reviews",     label: "⭐", sublabel: "Reviews", freeVisible: true },
              { id: "competitors", label: "🏆", sublabel: "Rivals",  freeVisible: true },
              { id: "map",         label: "🗺️", sublabel: "Map",     freeVisible: false },
              { id: "score",       label: "🧠", sublabel: "Intel",   freeVisible: false },
              { id: "health",      label: "🔧", sublabel: "Health",  freeVisible: false },
            ] as const
          ).filter(tab => (isPro || isGrowth) || tab.freeVisible).map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigateToTab(tab.id)}
              className="rc-bottom-tab-btn"
              style={{
                flex: 1,
                padding: "6px 4px",
                border: "none",
                borderTop: activeTab === tab.id ? "2px solid #1ABC9C" : "2px solid transparent",
                cursor: "pointer",
                background: activeTab === tab.id ? "rgba(26,188,156,0.06)" : "transparent",
                color: activeTab === tab.id ? "#1ABC9C" : "#4A5A57",
                fontSize: 18,
                fontFamily: "'DM Sans', sans-serif",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
            >
              <span>{tab.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === tab.id ? "#1ABC9C" : "#4A5A57" }}>{tab.sublabel}</span>
            </button>
          ))}
        </div>

        {/* ── CONTENT ANCHOR (scroll target) ───────────────── */}
        <div ref={contentRef} style={{ marginTop: 24 }} />

        {/* COMPETITORS TAB */}
        {activeTab === "competitors" && (
          <>
            {data.competitors.length > 0 &&
              reviews &&
              (() => {
                const topComp = [...data.competitors].sort(
                  (a, b) => a.googleRank - b.googleRank,
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                          {/* Google row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            <span style={{ fontSize: 10, color: "#6B7B78", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Google</span>
                          </div>
                          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: 22, fontWeight: 900, color: "#1ABC9C", fontFamily: "'Playfair Display', serif" }}>
                                {reviews.rating?.toFixed(1) ?? "—"} ⭐
                              </div>
                              <div style={{ fontSize: 11, color: "#6B7B78" }}>Rating</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 22, fontWeight: 900, color: "#1ABC9C", fontFamily: "'Playfair Display', serif" }}>
                                {reviews.total ?? "—"}
                              </div>
                              <div style={{ fontSize: 11, color: "#6B7B78" }}>Reviews</div>
                            </div>
                          </div>
                          {/* Divider */}
                          {data.yelpRating != null && (
                            <>
                              <div style={{ borderTop: "1px solid #2A3330", marginBottom: 12 }} />
                              {/* Yelp row */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24"><path d="M21.111 18.226c-.141.969-2.119 3.483-3.029 3.847-.311.124-.623.094-.867-.09-.148-.11-.258-.24-2.458-3.699l-.633-1.013a.866.866 0 0 1 .171-1.078.875.875 0 0 1 1.084-.036l.658.476c2.262 1.639 2.393 1.734 2.541 1.843.276.204.586.181.849-.046.373-.319.38-.856.08-1.247a.858.858 0 0 1-.077-.1l-.009-.013c-.111-.18-3.089-5.033-3.089-5.033a.868.868 0 0 1 .259-1.191.869.869 0 0 1 1.201.231c.021.033 2.954 4.768 2.954 4.768l.006.009c.138.212.325.341.53.363.22.024.437-.07.599-.255.232-.265.248-.649.049-.934-.006-.007-.008-.014-.014-.021L12.673 5.11a.907.907 0 0 1 .104-1.202.912.912 0 0 1 1.221.02l7.064 7.432c.012.012.025.025.037.039 1.223 1.486 1.276 4.046.012 6.827zm-10.6 3.569c-.14.622-.777 1.069-1.617 1.153-.828.083-2.885-.241-4.516-.784-.869-.286-1.305-.738-1.275-1.306.019-.368.199-.665.511-.837l4.168-2.328a.866.866 0 0 1 1.182.318l1.41 2.513a.867.867 0 0 1 .137.471v.8zM9.64 13.48a.865.865 0 0 1-.618.765l-4.664 1.338a.876.876 0 0 1-1.07-.569C3.018 13.973 2.876 12.04 3.21 10.32c.193-.993.629-1.483 1.294-1.458.381.014.659.168.818.318l4.178 3.326a.864.864 0 0 1 .317.69l-.177.284zm-.516-5.913L4.7 9.714a.878.878 0 0 1-1.136-.329.867.867 0 0 1 .001-.875C4.42 7.246 6.137 5.58 7.286 4.84c.618-.398 1.152-.429 1.542-.089.234.204.336.479.314.801L9 8.808a.862.862 0 0 1-.876.759z" fill="#FF1A1A"/></svg>
                                <span style={{ fontSize: 10, color: "#6B7B78", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
                                  {data.yelpUrl ? (
                                    <a href={data.yelpUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#6B7B78", textDecoration: "none" }}>Yelp</a>
                                  ) : "Yelp"}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: 16 }}>
                                <div>
                                  <div style={{ fontSize: 22, fontWeight: 900, color: "#FF1A1A", fontFamily: "'Playfair Display', serif" }}>
                                    {data.yelpRating.toFixed(1)} ⭐
                                  </div>
                                  <div style={{ fontSize: 11, color: "#6B7B78" }}>Rating</div>
                                </div>
                                {data.yelpReviewCount != null && (
                                  <div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: "#FF1A1A", fontFamily: "'Playfair Display', serif" }}>
                                      {data.yelpReviewCount}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#6B7B78" }}>Reviews</div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
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
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

            {(() => {
              // Build full ranked list: insert user's row at their rank position
              const PAGE_SIZE = 10;
              const allSorted = [...data.competitors].sort((a, b) => a.googleRank - b.googleRank);

              // Build display rows with user row injected at userRank position
              type Row = { isUser: true; rank: number } | { isUser: false; comp: typeof allSorted[0] };
              const rows: Row[] = [];
              let userInserted = false;
              for (const comp of allSorted) {
                if (!userInserted && typeof userRank === "number" && comp.googleRank >= userRank) {
                  rows.push({ isUser: true, rank: userRank });
                  userInserted = true;
                }
                rows.push({ isUser: false, comp });
              }
              if (!userInserted && typeof userRank === "number") {
                rows.push({ isUser: true, rank: userRank });
              }

              const totalPages = Math.ceil(rows.length / PAGE_SIZE);
              const pageRows = rows.slice(competitorPage * PAGE_SIZE, (competitorPage + 1) * PAGE_SIZE);

              return (
                <div style={{ background: "#151918", border: "1px solid #2A3330", borderRadius: 14, marginBottom: 24, overflow: "hidden" }}>
                  {/* Table title + competition intensity badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #1A2220" }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#F0EBE3" }}>
                      Local Ranking
                    </div>
                    {competitionIntensity && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: 20,
                        background: competitionIntensity.bg,
                        color: competitionIntensity.color,
                        fontFamily: "'DM Mono', monospace",
                        letterSpacing: 0.5,
                      }}>
                        {competitionIntensity.label}
                      </span>
                    )}
                  </div>
                  {/* Column headers */}
                  <div className="rc-comp-table-header" style={{ display: "grid", gridTemplateColumns: "48px 1fr 80px 80px 90px", padding: "10px 16px", borderBottom: "1px solid #1A2220", fontSize: 11, color: "#4A5A58", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                    <div>Rank</div>
                    <div>Clinic</div>
                    <div style={{ textAlign: "right" }}>Rating</div>
                    <div style={{ textAlign: "right" }}>Reviews</div>
                    <div style={{ textAlign: "right" }}>Status</div>
                  </div>

                  {pageRows.map((row, i) => {
                    if (row.isUser) {
                      return (
                        <div key={`user-${i}`} className="rc-comp-row-grid" style={{ display: "grid", gridTemplateColumns: "48px 1fr 80px 80px 90px", padding: "12px 16px", background: "rgba(26,188,156,0.07)", borderBottom: "1px solid #1A2220", alignItems: "center" }}>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 900, color: "#1ABC9C" }}>#{row.rank}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1ABC9C" }}>
                            {data.clinicName || "Your Practice"} <span style={{ fontSize: 10, background: "rgba(26,188,156,0.2)", color: "#1ABC9C", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>YOU</span>
                          </div>
                          <div style={{ textAlign: "right", fontWeight: 700, color: "#F0EBE3", fontSize: 13 }}>{reviews?.rating?.toFixed(1) ?? "—"} ⭐</div>
                          <div style={{ textAlign: "right", fontSize: 13, color: "#F0EBE3" }}>{reviews?.total ?? "—"}</div>
                          <div style={{ textAlign: "right" }} />
                        </div>
                      );
                    }
                    const comp = row.comp;
                    const isAhead = comp.googleRank < (userRank ?? 999);
                    return (
                      <div key={comp.googleRank} className="rc-comp-row-grid" style={{ display: "grid", gridTemplateColumns: "48px 1fr 80px 80px 90px", padding: "12px 16px", borderBottom: "1px solid #1A2220", alignItems: "center" }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "#6B7B78" }}>#{comp.googleRank}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#C8BFB6" }}>{comp.name}</div>
                          <div style={{ fontSize: 11, color: "#4A5A58", marginTop: 2 }}>{comp.address?.split(",").slice(0, 2).join(",")}</div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: 13, color: "#C8BFB6" }}>{comp.rating?.toFixed(1)} ⭐</div>
                        <div style={{ textAlign: "right", fontSize: 13, color: "#C8BFB6" }}>{comp.reviews}</div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: isAhead ? "rgba(231,76,60,0.1)" : "rgba(46,204,113,0.1)", color: isAhead ? "#E74C3C" : "#2ECC71" }}>
                            {isAhead ? "Ahead" : "Behind"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #1A2220" }}>
                      <button
                        onClick={() => setCompetitorPage(p => Math.max(0, p - 1))}
                        disabled={competitorPage === 0}
                        style={{ background: "none", border: "1px solid #2A3330", color: competitorPage === 0 ? "#2A3330" : "#C8BFB6", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: competitorPage === 0 ? "default" : "pointer" }}
                      >← Prev</button>
                      <span style={{ fontSize: 12, color: "#6B7B78" }}>Page {competitorPage + 1} of {totalPages}</span>
                      <button
                        onClick={() => setCompetitorPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={competitorPage === totalPages - 1}
                        style={{ background: "none", border: "1px solid #2A3330", color: competitorPage === totalPages - 1 ? "#2A3330" : "#C8BFB6", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: competitorPage === totalPages - 1 ? "default" : "pointer" }}
                      >Next →</button>
                    </div>
                  )}
                </div>
              );
            })()}

          </>
        )}

        {/* ROADMAP TAB */}
        {activeTab === "roadmap" && (
          <div
            className={tabFlash ? "card rc-section-flash" : "card"}
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
              <div>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  🗺️ Your Path to #1
                </div>
                <div style={{ fontSize: 12, color: "#6B7B78" }}>
                  Scores are out of 100 — combining your Google reviews, SEO, and website quality.
                </div>
                {/* Micro-progress bar */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: "#1A1F1E", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "12%", background: "linear-gradient(90deg, #1ABC9C, #16a085)", borderRadius: 4, animation: "progressFill 1s ease-out forwards", ["--pw" as string]: "12%" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#1ABC9C", fontWeight: 600, whiteSpace: "nowrap" as const }}>Step 1 of your visibility journey</span>
                </div>
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
                  flexShrink: 0,
                }}
              >
                GROWTH ROADMAP
              </span>
            </div>

            {(() => {
              // Not visible in top 60 — can't build a rank-based roadmap
              if (userRank == null) {
                return (
                  <div style={{ textAlign: "center", padding: "32px 20px" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🚨</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#E74C3C", marginBottom: 8 }}>Your practice isn&apos;t visible in the top 60 Google results</div>
                    <div style={{ fontSize: 13, color: "#6B7B78", lineHeight: 1.6, maxWidth: 420, margin: "0 auto 20px" }}>
                      Clinics outside the top 60 lose an estimated 25–40 patients per month to ranked competitors. More Google reviews is the single fastest way to start appearing — and recapturing those bookings.
                    </div>
                    <button onClick={() => setActiveTab("reviews")} style={{ background: "#1ABC9C", color: "#000", border: "none", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      Start Getting Reviews →
                    </button>
                  </div>
                );
              }

              const isTopThree = typeof userRank === "number" && userRank <= 3;

              // Derive a stable competitor context label from smoothed rank range
              // rankRangeLow/High reflect the observed rank band across recent scans
              const aheadCountLow = data.rankRangeLow != null ? Math.max(0, data.rankRangeLow - 1) : null;
              const aheadCountHigh = data.rankRangeHigh != null ? Math.max(0, data.rankRangeHigh - 1) : null;
              const competitorContextLabel = (() => {
                if (aheadCountLow != null && aheadCountHigh != null && aheadCountLow !== aheadCountHigh) {
                  return `Typically ${aheadCountLow}–${aheadCountHigh} nearby clinics appear ahead in local searches.`;
                }
                return "Nearby competition levels vary across neighbourhood searches.";
              })();

              // Competitors with lower googleRank number = ranked above user on Google
              // Sort descending so closest (rank just above user) comes first as Step 1
              const aheadComps = [...data.competitors]
                .filter((c) => typeof userRank === "number" ? c.googleRank < userRank : false)
                .sort((a, b) => b.googleRank - a.googleRank);

              // Competitors ranked below user — closest threat first (rank just below user)
              const behindComps = [...data.competitors]
                .filter((c) => typeof userRank === "number" ? c.googleRank > userRank : false)
                .sort((a, b) => a.googleRank - b.googleRank);

              if (isTopThree) {
                // DEFEND MODE — user is already in top 3
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Defend header banner */}
                    <div style={{
                      background: "rgba(46,204,113,0.06)",
                      border: "1px solid rgba(46,204,113,0.2)",
                      borderRadius: 12,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 4,
                    }}>
                      <span style={{ fontSize: 22 }}>🛡️</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#2ECC71", marginBottom: 2 }}>
                          You&apos;re in the Top 3 — protect your position
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7B78", lineHeight: 1.5 }}>
                          These practices are closing in. Clinics that stop collecting reviews drop in rank within weeks — losing bookings to the clinics that didn&apos;t.
                        </div>
                      </div>
                    </div>

                    {behindComps.length === 0 && (
                      <div style={{ fontSize: 13, color: "#6B7B78", textAlign: "center", padding: "20px 0" }}>
                        No competitors tracked behind you yet.
                      </div>
                    )}

                    {behindComps.map((comp, i) => {
                      const gap = Math.max(0, (reviews?.total || 0) - (comp.reviews || 0)); // review lead over this competitor
                      const isLocked = !isPro;
                      const urgency = gap <= 10 ? "high" : gap <= 30 ? "medium" : "low";
                      const catchUpTime = gap <= 10 ? "2–4 weeks" : gap <= 30 ? "1–2 months" : "2–4 months";
                      const urgencyColor = urgency === "high" ? "#E74C3C" : urgency === "medium" ? "#F0A500" : "#6B7B78";
                      const compName = (comp.name || "Competitor").length > 28
                        ? (comp.name || "Competitor").slice(0, 28) + "..."
                        : comp.name || "Competitor";
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
                            background: isLocked ? "#0D0F0E" : urgency === "high" ? "rgba(231,76,60,0.04)" : "rgba(240,165,0,0.03)",
                            border: `1px solid ${isLocked ? "#1A1F1E" : urgency === "high" ? "rgba(231,76,60,0.2)" : "rgba(240,165,0,0.15)"}`,
                          }}
                        >
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: isLocked ? "#1A1F1E" : `${urgencyColor}18`,
                            border: `2px solid ${isLocked ? "#2A3330" : urgencyColor}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, flexShrink: 0,
                          }}>
                            {isLocked ? "🔒" : urgency === "high" ? "⚠️" : "👁️"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: isLocked ? "#6B7B78" : "#F0EBE3" }}>
                                {compName}
                              </div>
                              {i === 0 && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                                  background: "rgba(231,76,60,0.12)", color: "#E74C3C",
                                  fontFamily: "'DM Mono', monospace",
                                }}>
                                  CLOSEST THREAT
                                </span>
                              )}
                            </div>
                            {!isLocked ? (
                              <div style={{ fontSize: 12, color: "#6B7B78", lineHeight: 1.6 }}>
                                Only {gap} review{gap === 1 ? "" : "s"} behind you — if they overtake your rank, they capture your patients. Estimated{" "}
                                <span style={{ color: urgencyColor, fontWeight: 600 }}>{catchUpTime}</span>{" "}
                                until they could outrank you.{urgency === "high" ? " Act now." : ""}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: "#6B7B78" }}>🔒 Unlock to see how close this clinic is to stealing your rank</div>
                            )}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, color: isLocked ? "#6B7B78" : urgencyColor }}>
                              #{comp.googleRank}
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7B78" }}>Google rank</div>
                            <div style={{ fontSize: 11, color: "#2ECC71", marginTop: 2 }}>
                              {gap > 0 ? `~${gap} review lead` : "similar reviews"}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Review CTA */}
                    <div
                      onClick={() => setActiveTab("reviews")}
                      style={{
                        background: "rgba(26,188,156,0.06)",
                        border: "1px solid rgba(26,188,156,0.25)",
                        borderRadius: 12,
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginTop: 4,
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 22 }}>⭐</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1ABC9C", marginBottom: 3 }}>
                          Keep your lead — collect reviews effortlessly
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7B78" }}>
                          Every review widens your lead — clinics with more reviews consistently attract more appointment requests and hold rank longer.
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1ABC9C", whiteSpace: "nowrap" }}>
                        Go to Reviews →
                      </div>
                    </div>
                  </div>
                );
              }

              // GROWTH MODE — user is NOT in top 3, show path to overtake leaders
              const stepsToShow = aheadComps;
              // Free users: show next step + 2 upcoming, collapse the rest
              const freeUser = !isPro && !isGrowth;
              const visibleSteps = freeUser ? stepsToShow.slice(0, 3) : stepsToShow;
              const hiddenCount = freeUser ? Math.max(0, stepsToShow.length - 3) : 0;
              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {/* Focus message for free users */}
                  {freeUser && stepsToShow.length > 0 && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      background: "rgba(26,188,156,0.06)",
                      border: "1px solid rgba(26,188,156,0.15)",
                      borderRadius: 10,
                    }}>
                      <span style={{ fontSize: 14 }}>🎯</span>
                      <div style={{ fontSize: 12, color: "rgba(247,243,237,0.6)", lineHeight: 1.5 }}>
                        Each step you complete moves more local patients toward your clinic.{" "}
                        <span style={{ color: "#6B7B78" }}>{competitorContextLabel}</span>
                      </div>
                    </div>
                  )}

                  {visibleSteps.map((comp, i) => {
                    const reviewGap = Math.max(0, (comp.reviews || 0) - (reviews?.total || 0));
                    const weeks =
                      reviewGap <= 10
                        ? "2–4 weeks"
                        : reviewGap <= 30
                          ? "1–2 months"
                          : "2–4 months";
                    // For free users: step 0 is active, steps 1 & 2 are upcoming (dimmed)
                    const isUpcoming = freeUser && i > 0;
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
                          background: isUpcoming
                            ? "rgba(240,165,0,0.02)"
                            : "rgba(240,165,0,0.04)",
                          border: `1px solid ${isUpcoming ? "rgba(240,165,0,0.08)" : "rgba(240,165,0,0.2)"}`,
                          opacity: isUpcoming ? 0.45 : 1,
                          filter: isUpcoming ? "blur(0.4px)" : "none",
                          transition: "opacity 0.2s",
                          pointerEvents: isUpcoming ? "none" : "auto",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: isUpcoming
                              ? "#1A1F1E"
                              : "rgba(240,165,0,0.12)",
                            border: `2px solid ${isUpcoming ? "#2A3330" : "#F0A500"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {`${i + 1}`}
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
                                color: isUpcoming ? "#6B7B78" : "#F0EBE3",
                              }}
                            >
                              Step {i + 1}: Overtake{" "}
                              {(comp.name || "Competitor").length > 25
                                ? (comp.name || "Competitor").slice(0, 25) + "..."
                                : comp.name || "Competitor"}
                            </div>
                            {i === 0 && (
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
                                NEXT STEP
                              </span>
                            )}
                            {isUpcoming && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "rgba(107,123,120,0.12)",
                                  color: "#6B7B78",
                                  fontFamily: "'DM Mono', monospace",
                                }}
                              >
                                UP NEXT
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6B7B78",
                              lineHeight: 1.6,
                            }}
                          >
                            {reviewGap > 0
                              ? `Closing this review gap moves you up in rank and recaptures lost bookings — estimated `
                              : `Clinics gaining steady reviews often move ahead of similarly rated competitors — estimated `}
                            <span style={{ color: isUpcoming ? "#6B7B78" : "#F0A500", fontWeight: 600 }}>
                              {weeks}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 16,
                              fontWeight: 700,
                              color: isUpcoming ? "#6B7B78" : "#F0A500",
                            }}
                          >
                            #{comp.googleRank}
                          </div>
                          <div style={{ fontSize: 11, color: "#6B7B78" }}>Google rank</div>
                          <div style={{ fontSize: 11, color: "#E74C3C", marginTop: 2 }}>
                            {reviewGap > 0 ? `~${reviewGap} more reviews` : "similar review count"}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Collapsed remaining steps for free users */}
                  {hiddenCount > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        borderRadius: 10,
                        background: "#0D0F0E",
                        border: "1px dashed #1A1F1E",
                        cursor: "pointer",
                      }}
                      onClick={() => setShowUpgradeModal(true)}
                    >
                      <div style={{ display: "flex", gap: 4 }}>
                        {Array.from({ length: Math.min(hiddenCount, 4) }).map((_, k) => (
                          <div key={k} style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: "#2A3330",
                          }} />
                        ))}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: "#6B7B78" }}>
                        {aheadCountLow != null && aheadCountHigh != null && aheadCountLow !== aheadCountHigh
                          ? `Your clinic is usually competing against ${aheadCountLow}–${aheadCountHigh} nearby visible clinics — unlock the full path to Top 3`
                          : "Several more clinics typically appear ahead locally — unlock your full path to Top 3"}
                      </div>
                      <span style={{ fontSize: 11, color: "#1ABC9C", fontWeight: 700 }}>
                        See How to Move Up →
                      </span>
                    </div>
                  )}

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
                            ? `Rank #1 in ${displayCity}`
                            : `Top 3 in ${displayCity}`}
                        </div>
                        {isGrowth ? (
                          <div style={{ fontSize: 12, color: "#2ECC71" }}>
                            ✅ Full growth plan is active — keep following the
                            steps above!
                          </div>
                        ) : isPro ? (
                          <div style={{ fontSize: 12, color: "#6B7B78" }}>
                            🚀 Get a done-for-you plan to accelerate patient growth
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#6B7B78" }}>
                            🔒 Unlock your full step-by-step patient growth plan
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
                          {isPro ? "See Full Growth Plan →" : "Unlock Your Growth Plan →"}
                        </button>
                      )}
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
            className={tabFlash ? "card rc-section-flash" : "card"}
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  ⭐ What Patients Are Saying About You
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  <span style={{ fontSize: 13, color: "#6B7B78" }}>+</span>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M21.111 18.226c-.141.969-2.119 3.483-3.029 3.847-.311.124-.623.094-.867-.09-.148-.11-.258-.24-2.458-3.699l-.633-1.013a.866.866 0 0 1 .171-1.078.875.875 0 0 1 1.084-.036l.658.476c2.262 1.639 2.393 1.734 2.541 1.843.276.204.586.181.849-.046.373-.319.38-.856.08-1.247a.858.858 0 0 1-.077-.1l-.009-.013c-.111-.18-3.089-5.033-3.089-5.033a.868.868 0 0 1 .259-1.191.869.869 0 0 1 1.201.231c.021.033 2.954 4.768 2.954 4.768l.006.009c.138.212.325.341.53.363.22.024.437-.07.599-.255.232-.265.248-.649.049-.934-.006-.007-.008-.014-.014-.021L12.673 5.11a.907.907 0 0 1 .104-1.202.912.912 0 0 1 1.221.02l7.064 7.432c.012.012.025.025.037.039 1.223 1.486 1.276 4.046.012 6.827zm-10.6 3.569c-.14.622-.777 1.069-1.617 1.153-.828.083-2.885-.241-4.516-.784-.869-.286-1.305-.738-1.275-1.306.019-.368.199-.665.511-.837l4.168-2.328a.866.866 0 0 1 1.182.318l1.41 2.513a.867.867 0 0 1 .137.471v.8zM9.64 13.48a.865.865 0 0 1-.618.765l-4.664 1.338a.876.876 0 0 1-1.07-.569C3.018 13.973 2.876 12.04 3.21 10.32c.193-.993.629-1.483 1.294-1.458.381.014.659.168.818.318l4.178 3.326a.864.864 0 0 1 .317.69l-.177.284zm-.516-5.913L4.7 9.714a.878.878 0 0 1-1.136-.329.867.867 0 0 1 .001-.875C4.42 7.246 6.137 5.58 7.286 4.84c.618-.398 1.152-.429 1.542-.089.234.204.336.479.314.801L9 8.808a.862.862 0 0 1-.876.759z" fill="#FF1A1A"/></svg>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {reviews?.reviewSources && (
                  <span style={{ fontSize: 11, color: "#6B7B78", fontFamily: "'DM Mono', monospace" }}>
                    {reviews.reviewSources.google}G + {reviews.reviewSources.yelp}Y
                  </span>
                )}
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
                      ? "Automate Your Review Collection →"
                      : "Start Getting More Patient Reviews →"}
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
                    {(() => {
                      const pos = reviews.sentimentBreakdown?.positive ?? 0;
                      const neg = reviews.sentimentBreakdown?.negative ?? 0;
                      const verdict = pos >= 70 ? { label: "Mostly Positive", color: "#2ECC71", bg: "rgba(46,204,113,0.1)", emoji: "😊" }
                        : neg >= 30 ? { label: "Needs Attention", color: "#E74C3C", bg: "rgba(231,76,60,0.1)", emoji: "⚠️" }
                        : { label: "Mixed", color: "#F0A500", bg: "rgba(240,165,0,0.1)", emoji: "😐" };
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: verdict.bg }}>
                            <span style={{ fontSize: 20 }}>{verdict.emoji}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: verdict.color }}>{verdict.label}</span>
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            {[
                              { label: "Happy", pct: pos, color: "#2ECC71" },
                              { label: "Neutral", pct: reviews.sentimentBreakdown?.neutral ?? 0, color: "#F0A500" },
                              { label: "Unhappy", pct: neg, color: "#E74C3C" },
                            ].map(({ label, pct, color }) => (
                              <div key={label} style={{ flex: 1, textAlign: "center", padding: "8px 4px", background: "#0D1210", borderRadius: 8 }}>
                                <div style={{ fontSize: 16, fontWeight: 900, color, fontFamily: "'Playfair Display', serif" }}>{pct}%</div>
                                <div style={{ fontSize: 10, color: "#6B7B78", marginTop: 2 }}>{label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
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
                      REPLYING TO REVIEWS
                    </div>
                    <div style={{ fontSize: 14, color: "#F0EBE3", lineHeight: 1.6 }}>
                      {(reviews.responseRate ?? 0) >= 70
                        ? "✅ You reply to most reviews — this builds trust and boosts your Google ranking."
                        : (reviews.responseRate ?? 0) >= 40
                        ? "⚠️ You reply to some reviews but not all. Try to respond to every patient — it shows you care."
                        : "❌ You rarely reply to reviews. Responding to patients is one of the easiest ways to improve your ranking."}
                    </div>
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
            className={tabFlash ? "card rc-section-flash" : "card"}
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

          </div>
        )}

        {/* MAP TAB */}
        {activeTab === "map" && (
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>
                🗺️ Local Rankings Map
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6B7B78" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#1ABC9C", display: "inline-block" }} /> You
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6B7B78" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2ECC71", display: "inline-block" }} /> Top 3
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6B7B78" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#F0A500", display: "inline-block" }} /> #4–10
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6B7B78" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E74C3C", display: "inline-block" }} /> #11+
                </span>
              </div>
            </div>
            <MapView data={data} isPro={isPro || isGrowth} onUpgrade={() => setShowUpgradeModal(true)} />
          </div>
        )}

        {/* HEALTH TAB */}
        {activeTab === "health" && (
          <div
            className={tabFlash ? "card rc-section-flash" : "card"}
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

            {/* Healthgrades check */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderTop: "1px solid #1A2421" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: data.healthgradesFound ? (data.healthgradesClaimed === false ? "#F0A500" : "#2ECC71") : "#E74C3C", flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: data.healthgradesFound ? "#F0EBE3" : "#E74C3C" }}>
                  {data.healthgradesFound
                    ? data.healthgradesClaimed === false
                      ? "⚠️ Healthgrades Profile Unclaimed"
                      : "Found on Healthgrades ✅"
                    : "❌ No Healthgrades Profile — Action Required"}
                </div>
                {data.healthgradesFound && (
                  <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                    {data.healthgradesRating != null && (
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#1ABC9C", fontFamily: "'Playfair Display', serif" }}>{data.healthgradesRating.toFixed(1)} ⭐</div>
                        <div style={{ fontSize: 11, color: "#6B7B78" }}>Healthgrades Rating</div>
                      </div>
                    )}
                    {data.healthgradesReviews != null && (
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#1ABC9C", fontFamily: "'Playfair Display', serif" }}>{data.healthgradesReviews}</div>
                        <div style={{ fontSize: 11, color: "#6B7B78" }}>Healthgrades Reviews</div>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#6B7B78", marginTop: 4 }}>
                  {data.healthgradesFound
                    ? data.healthgradesClaimed === false
                      ? "Unclaimed profiles lose ~15% of patient trust — anyone can edit yours and it appears abandoned. Claiming takes 5 minutes."
                      : "A verified Healthgrades profile captures additional inquiries from the ~25% of patients who check it before booking."
                    : "1 in 4 patients checks Healthgrades before choosing a dentist. Without a profile, you're invisible to that entire audience."}
                </div>
                {data.healthgradesFound && data.healthgradesUrl && (
                  <a href={data.healthgradesUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 700, color: "#1ABC9C", textDecoration: "underline" }}>
                    View your Healthgrades profile →
                  </a>
                )}
                {!data.healthgradesFound && (
                  <a href="https://www.healthgrades.com/office-registration" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 700, color: "#1ABC9C", textDecoration: "underline" }}>
                    Create your free Healthgrades profile →
                  </a>
                )}
              </div>
              {!data.healthgradesFound && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(231,76,60,0.12)", color: "#E74C3C", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>HIGH</span>
              )}
              {data.healthgradesClaimed === false && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(240,165,0,0.12)", color: "#F0A500", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>MED</span>
              )}
            </div>

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
                "Add 'dentist + your city' to your homepage title — helps Google connect your site to local searches",
                "Complete your Google Business Profile — complete profiles attract significantly more clicks than incomplete ones",
                "Ask your last 10 patients for a Google review — consistent reviews are the fastest way to improve local visibility",
                "Add your clinic hours to Google — missing hours cause patients to choose a clinic they can verify is open",
                "Upload 10+ photos to Google Business — listings with photos consistently attract more engagement",
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

      {/* ── SAVE REPORT BANNER (anonymous users) ── */}
      {/* EXIT INTENT POPUP */}
      {showExitIntent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ background: "#151918", border: "1px solid #2A3330", borderRadius: 16, padding: "32px 28px", maxWidth: 400, width: "90%" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#F7F3ED", marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>Before you go...</div>
            <div style={{ fontSize: 14, color: "#6B7B78", marginBottom: 24 }}>What stopped you from upgrading today?</div>
            {["Too expensive", "Not sure it works", "Just browsing", "Need to think about it"].map((opt) => (
              <button
                key={opt}
                onClick={() => submitExitIntent(opt)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "12px 16px", marginBottom: 8,
                  background: "#0D0F0E", border: "1px solid #2A3330",
                  borderRadius: 10, color: "#B0BDB9", fontSize: 14,
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget).style.borderColor = "#1ABC9C"; (e.currentTarget).style.color = "#F7F3ED"; }}
                onMouseLeave={e => { (e.currentTarget).style.borderColor = "#2A3330"; (e.currentTarget).style.color = "#B0BDB9"; }}
              >
                {opt}
              </button>
            ))}
            <button onClick={() => setShowExitIntent(false)} style={{ marginTop: 8, background: "none", border: "none", color: "#4A5A57", fontSize: 13, cursor: "pointer", width: "100%", textAlign: "center" }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {showFeedbackModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ background: "#151918", border: "1px solid #2A3330", borderRadius: 16, padding: "28px 24px", maxWidth: 380, width: "90%" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#F7F3ED", marginBottom: 6, fontFamily: "'Playfair Display', serif" }}>Give Feedback</div>
            <div style={{ fontSize: 13, color: "#6B7B78", marginBottom: 16 }}>Tell us what's working or what could be better.</div>
            {feedbackSent ? (
              <div style={{ color: "#1ABC9C", fontSize: 15, fontWeight: 600, textAlign: "center", padding: "16px 0" }}>✓ Thanks for your feedback!</div>
            ) : (
              <>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Your thoughts..."
                  rows={4}
                  style={{ width: "100%", padding: "10px 12px", background: "#0D0F0E", border: "1px solid #2A3330", borderRadius: 8, color: "#F7F3ED", fontSize: 14, resize: "vertical", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={submitFeedback} disabled={!feedbackText.trim()} style={{ flex: 1, padding: "10px", background: "#1ABC9C", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: !feedbackText.trim() ? 0.5 : 1 }}>
                    Submit
                  </button>
                  <button onClick={() => setShowFeedbackModal(false)} style={{ padding: "10px 16px", background: "transparent", border: "1px solid #2A3330", borderRadius: 8, color: "#6B7B78", fontSize: 14, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSaveBanner && (
        <div className="rc-save-banner" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#151918", borderTop: "1px solid #2A3330", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 1000, fontFamily: "'DM Sans', sans-serif" }}>
          {bannerSent ? (
            <>
              <span style={{ color: "#1ABC9C", fontSize: 14, fontWeight: 600 }}>✓ Your dashboard is secured.</span>
              <button onClick={() => setShowSaveBanner(false)} style={{ background: "none", border: "none", color: "#6B7B78", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
            </>
          ) : (
            <>
              <span style={{ color: "#F7F3ED", fontSize: 14 }}>Secure your dashboard</span>
              <input
                type="email"
                value={bannerEmail}
                onChange={e => setBannerEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitBannerEmail()}
                placeholder="your@email.com"
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #2A3330", background: "#0D0F0E", color: "#F7F3ED", fontSize: 14, width: 220 }}
              />
              <button onClick={submitBannerEmail} disabled={!bannerEmail.includes("@")} className="rc-save-btn" style={{ padding: "8px 16px", borderRadius: 8, background: "#1ABC9C", color: "#000", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", opacity: !bannerEmail.includes("@") ? 0.5 : 1 }}>
                Save →
              </button>
              <button onClick={() => setShowSaveBanner(false)} style={{ background: "none", border: "none", color: "#6B7B78", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
            </>
          )}
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
