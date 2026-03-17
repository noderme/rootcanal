"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function HomeInner() {
  const [url, setUrl] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicCity, setClinicCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [mode, setMode] = useState<"website" | "gbp">("website");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // If ?url= is in the link, auto-fill and immediately redirect to dashboard
  useEffect(() => {
    const urlParam = searchParams.get("url");
    const nameParam = searchParams.get("name");
    const cityParam = searchParams.get("city");
    if (urlParam) {
      let cleanUrl = urlParam.trim().toLowerCase();
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        cleanUrl = "https://" + cleanUrl;
      }
      router.push(`/dashboard?url=${encodeURIComponent(cleanUrl)}`);
    } else if (nameParam && cityParam) {
      router.push(`/dashboard?name=${encodeURIComponent(nameParam)}&city=${encodeURIComponent(cityParam)}`);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (cityQuery.length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/cities?input=${encodeURIComponent(cityQuery)}`)
        .then(r => r.json())
        .then(d => setCitySuggestions(d.suggestions || []));
    }, 250);
    return () => clearTimeout(t);
  }, [cityQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "website") {
      if (!url) { setLoading(false); return; }
      let cleanUrl = url.trim().toLowerCase();
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        cleanUrl = "https://" + cleanUrl;
      }
      router.push(`/dashboard?url=${encodeURIComponent(cleanUrl)}`);
    } else {
      if (!clinicName || !clinicCity) { setLoading(false); return; }
      router.push(`/dashboard?name=${encodeURIComponent(clinicName.trim())}&city=${encodeURIComponent(clinicCity.trim())}`);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --cream: #F7F3ED; --dark: #1A1410; --red: #C0392B;
          --red-light: #E74C3C; --gold: #D4A843; --muted: #7A6F65; --border: #E0D9D0;
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--dark); overflow-x: hidden; }
        .rc-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 20px 60px; background: rgba(247,243,237,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
        .rc-logo { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: var(--dark); text-decoration: none; }
        .rc-logo span { color: var(--red); }
        .rc-nav-links { display: flex; gap: 36px; align-items: center; }
        .rc-nav-link { font-size: 14px; font-weight: 500; color: var(--muted); text-decoration: none; transition: color 0.2s; }
        .rc-nav-link:hover { color: var(--dark); }
        .rc-nav-cta { background: var(--dark); color: var(--cream) !important; padding: 10px 22px; border-radius: 6px; font-weight: 600 !important; transition: background 0.2s; }
        .rc-nav-cta:hover { background: var(--red) !important; }
        .rc-hero { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; padding: 100px 60px 32px; gap: 60px; align-items: center; position: relative; overflow: hidden; }
        .rc-hero::before { content: ''; position: absolute; top: -100px; right: -100px; width: 600px; height: 600px; background: radial-gradient(circle, rgba(192,57,43,0.08) 0%, transparent 70%); pointer-events: none; }
        .rc-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--red); margin-bottom: 12px; }
        .rc-eyebrow::before { content: ''; width: 24px; height: 2px; background: var(--red); }
        .rc-h1 { font-family: 'Playfair Display', serif; font-size: clamp(36px, 4.5vw, 58px); font-weight: 900; line-height: 1.05; letter-spacing: -2px; color: var(--dark); margin-bottom: 12px; }
        .rc-h1 em { font-style: italic; color: var(--red); }
        .rc-sub { font-size: 17px; line-height: 1.6; color: var(--muted); max-width: 480px; margin-bottom: 16px; font-weight: 300; }
        .rc-form-wrap { display: flex; flex-direction: column; gap: 12px; max-width: 500px; }
        .rc-scan-box { display: flex; border: 2px solid var(--dark); border-radius: 8px; overflow: hidden; background: white; box-shadow: 6px 6px 0 var(--dark); transition: box-shadow 0.2s; }
        .rc-scan-box:focus-within { box-shadow: 8px 8px 0 var(--red); }
        .rc-input { flex: 1; border: none; outline: none; padding: 16px 20px; font-family: 'DM Sans', sans-serif; font-size: 15px; background: transparent; color: var(--dark); }
        .rc-input::placeholder { color: #BBB; }
        .rc-btn { background: var(--dark); color: var(--cream); border: none; padding: 16px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; transition: background 0.2s; border-radius: 8px; }
        .rc-btn:hover { background: var(--red); }
        .rc-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .rc-note { margin-top: 14px; font-size: 13px; color: var(--muted); display: flex; gap: 20px; }
        .rc-note span::before { content: '✓ '; color: var(--red); font-weight: 700; }
        .rc-hero-visual { display: flex; justify-content: center; align-items: center; animation: floatUp 0.8s ease both; animation-delay: 0.3s; }
        @keyframes floatUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .rc-score-card { background: white; border: 2px solid var(--dark); border-radius: 16px; padding: 36px; width: 100%; max-width: 400px; box-shadow: 10px 10px 0 var(--dark); }
        .rc-score-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
        .rc-score-label { font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
        .rc-clinic-name { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .rc-clinic-loc { font-size: 13px; color: var(--muted); }
        .rc-score-badge { background: var(--red); color: white; font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 900; width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .rc-score-item { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
        .rc-score-item:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
        .rc-item-left { display: flex; align-items: center; gap: 12px; }
        .rc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-red { background: var(--red); } .dot-gold { background: var(--gold); } .dot-green { background: #27AE60; }
        .rc-badge { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
        .bad { background: #FDECEA; color: var(--red); } .warn { background: #FEF9E7; color: #B7950B; } .good { background: #EAFAF1; color: #1E8449; }
        .rc-card-footer { margin-top: 24px; padding-top: 20px; border-top: 2px dashed var(--border); font-size: 13px; color: var(--muted); text-align: center; }
        .rc-card-footer strong { color: var(--red); }
        .rc-stats { background: var(--dark); color: var(--cream); padding: 28px 60px; display: flex; justify-content: space-around; align-items: center; gap: 40px; }
        .rc-stat { text-align: center; }
        .rc-stat-num { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 900; color: var(--gold); display: block; }
        .rc-stat-lbl { font-size: 13px; color: rgba(247,243,237,0.6); margin-top: 4px; }
        .rc-divider { width: 1px; height: 50px; background: rgba(255,255,255,0.1); }
        .rc-section { padding: 100px 60px; }
        .rc-sec-label { font-size: 12px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: var(--red); margin-bottom: 16px; }
        .rc-sec-title { font-family: 'Playfair Display', serif; font-size: clamp(32px, 4vw, 52px); font-weight: 900; letter-spacing: -1.5px; line-height: 1.1; margin-bottom: 60px; max-width: 600px; }
        .rc-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
        .rc-step { padding: 36px; border: 2px solid var(--border); border-radius: 12px; background: white; transition: transform 0.2s, box-shadow 0.2s; }
        .rc-step:hover { transform: translateY(-4px); box-shadow: 6px 6px 0 var(--dark); }
        .rc-step-num { font-family: 'Playfair Display', serif; font-size: 60px; font-weight: 900; color: var(--border); line-height: 1; margin-bottom: 20px; }
        .rc-step h3 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
        .rc-step p { font-size: 15px; line-height: 1.7; color: var(--muted); }
        .rc-problems { background: var(--dark); color: var(--cream); padding: 100px 60px; }
        .rc-problems-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        .rc-problem-card { border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; background: rgba(255,255,255,0.04); display: flex; gap: 20px; align-items: flex-start; transition: background 0.2s; }
        .rc-problem-card:hover { background: rgba(255,255,255,0.08); }
        .rc-problem-icon { font-size: 28px; flex-shrink: 0; width: 52px; height: 52px; background: rgba(192,57,43,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .rc-problem-card h4 { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
        .rc-problem-card p { font-size: 14px; line-height: 1.7; color: rgba(247,243,237,0.55); }
        .rc-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .rc-feature-card { padding: 32px; border-radius: 12px; border: 2px solid var(--border); background: white; transition: transform 0.2s, border-color 0.2s; }
        .rc-feature-card:hover { transform: translateY(-3px); border-color: var(--red); }
        .rc-feature-icon { font-size: 28px; margin-bottom: 16px; display: block; }
        .rc-feature-card h4 { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
        .rc-feature-card p { font-size: 14px; line-height: 1.7; color: var(--muted); }
        .rc-pricing { padding: 100px 60px; }
        .rc-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; max-width: 900px; margin: 0 auto; }
        .rc-pricing-card { border: 2px solid var(--border); border-radius: 16px; padding: 40px 32px; background: white; text-align: center; position: relative; transition: transform 0.2s; }
        .rc-pricing-card:hover { transform: translateY(-4px); }
        .rc-pricing-card.featured { border-color: var(--dark); background: var(--dark); color: var(--cream); box-shadow: 8px 8px 0 var(--red); }
        .rc-pricing-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--red); color: white; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 5px 16px; border-radius: 20px; }
        .rc-pricing-plan { font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }
        .featured .rc-pricing-plan { color: rgba(247,243,237,0.5) !important; }
        .rc-pricing-price { font-family: 'Playfair Display', serif; font-size: 52px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
        .rc-pricing-period { font-size: 14px; color: var(--muted); margin-bottom: 28px; }
        .featured .rc-pricing-period { color: rgba(247,243,237,0.5) !important; }
        .rc-pricing-features { list-style: none; text-align: left; margin-bottom: 32px; display: flex; flex-direction: column; gap: 12px; }
        .rc-pricing-features li { font-size: 14px; display: flex; align-items: center; gap: 10px; }
        .rc-pricing-features li::before { content: '✓'; color: var(--red); font-weight: 700; flex-shrink: 0; }
        .featured .rc-pricing-features li::before { color: var(--gold) !important; }
        .rc-pricing-btn { display: block; width: 100%; padding: 14px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; border: 2px solid var(--dark); background: transparent; color: var(--dark); transition: all 0.2s; text-decoration: none; text-align: center; }
        .rc-pricing-btn:hover { background: var(--dark); color: var(--cream); }
        .featured .rc-pricing-btn { background: var(--red) !important; color: white !important; border-color: var(--red) !important; }
        .rc-cta-section { padding: 100px 60px; background: var(--red); text-align: center; position: relative; overflow: hidden; }
        .rc-cta-section::before { content: '🦷'; position: absolute; font-size: 300px; opacity: 0.06; top: -60px; right: -40px; pointer-events: none; }
        .rc-cta-section h2 { font-family: 'Playfair Display', serif; font-size: clamp(36px, 5vw, 60px); font-weight: 900; color: white; letter-spacing: -2px; margin-bottom: 20px; line-height: 1.1; }
        .rc-cta-section p { font-size: 18px; color: rgba(255,255,255,0.8); margin-bottom: 40px; max-width: 500px; margin-left: auto; margin-right: auto; }
        .rc-cta-form { display: flex; max-width: 480px; margin: 0 auto; border: 3px solid white; border-radius: 8px; overflow: hidden; box-shadow: 8px 8px 0 rgba(0,0,0,0.2); }
        .rc-cta-form input { flex: 1; border: none; outline: none; padding: 16px 20px; font-family: 'DM Sans', sans-serif; font-size: 15px; }
        .rc-cta-form button { background: var(--dark); color: white; border: none; padding: 16px 28px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
        .rc-cta-form button:hover { background: #000; }
        .rc-footer { background: var(--dark); color: rgba(247,243,237,0.4); padding: 40px 60px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .rc-footer a { color: inherit; text-decoration: none; }
        .rc-city-wrap { position: relative; }
        .rc-suggestions { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 2px solid var(--dark); border-radius: 8px; box-shadow: 6px 6px 0 var(--dark); z-index: 100; overflow: hidden; }
        .rc-suggestion-item { padding: 12px 20px; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: var(--dark); transition: background 0.15s; border-bottom: 1px solid var(--border); }
        .rc-suggestion-item:last-child { border-bottom: none; }
        .rc-suggestion-item:hover { background: var(--cream); }
        .rc-suggestion-pin { font-size: 14px; flex-shrink: 0; }
      `}</style>

      {/* NAV */}
      <nav className="rc-nav">
        <Link href="/" className="rc-logo">
          Root<span>Canal</span>
        </Link>
        <div className="rc-nav-links">
          <a href="#how" className="rc-nav-link">
            How it works
          </a>
          <a href="#features" className="rc-nav-link">
            Features
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="rc-hero">
        <div>
          <div className="rc-eyebrow">
            Free Competitive Analysis for Dental Clinics
          </div>
          <h1 className="rc-h1">
            Your Clinic is Losing Patients
            <br />
            <em>to Competitors on Google</em>
          </h1>
          <p className="rc-sub">
            See exactly why — and fix it in minutes.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--dark)",
              fontWeight: 600,
              marginBottom: 16,
              maxWidth: 480,
              lineHeight: 1.6,
              background: "rgba(212,168,67,0.12)",
              border: "1px solid rgba(212,168,67,0.3)",
              borderRadius: 10,
              padding: "12px 16px",
            }}
          >
            Get more Google & Yelp reviews, track competitors, and
            improve your clinic&apos;s visibility — all in one simple dashboard.
          </p>

          <form id="audit" onSubmit={handleSubmit} className="rc-form-wrap">
            {/* Mode toggle */}
            <div style={{ display: "flex", background: "rgba(0,0,0,0.07)", borderRadius: 10, padding: 4, marginBottom: 12, border: "1px solid rgba(0,0,0,0.1)" }}>
              <button
                type="button"
                onClick={() => setMode("website")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.15s",
                  background: mode === "website" ? "#fff" : "transparent",
                  color: mode === "website" ? "#1a1a1a" : "rgba(0,0,0,0.4)",
                  boxShadow: mode === "website" ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                }}
              >
                🌐 I have a website
              </button>
              <button
                type="button"
                onClick={() => setMode("gbp")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.15s",
                  background: mode === "gbp" ? "#fff" : "transparent",
                  color: mode === "gbp" ? "#1a1a1a" : "rgba(0,0,0,0.4)",
                  boxShadow: mode === "gbp" ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                }}
              >
                📍 Google listing only
              </button>
            </div>

            {mode === "website" ? (
              <div className="rc-scan-box">
                <input
                  className="rc-input"
                  type="text"
                  placeholder="Enter your clinic website e.g. smilesdental.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div style={{ display: "flex", gap: 0 }}>
                <div className="rc-scan-box" style={{ flex: 1, borderRight: "none", borderRadius: "8px 0 0 8px", boxShadow: "none" }}>
                  <input
                    className="rc-input"
                    type="text"
                    placeholder="Clinic name"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ position: "relative", flex: 1 }}>
                  <div className="rc-scan-box" style={{ borderRadius: "0 8px 8px 0", boxShadow: "6px 6px 0 var(--dark)" }}>
                    <input
                      className="rc-input"
                      type="text"
                      placeholder="City e.g. Austin, TX"
                      value={cityQuery || clinicCity}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCityQuery(next);
                        setClinicCity("");
                        setShowCitySuggestions(true);
                        if (next.length < 2) setCitySuggestions([]);
                      }}
                      onFocus={() => setShowCitySuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                      style={{ width: "100%" }}
                      required
                    />
                  </div>
                  {showCitySuggestions && citySuggestions.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "2px solid #1a1a1a",
                      borderTop: "none",
                      borderRadius: "0 0 8px 8px",
                      zIndex: 100,
                      boxShadow: "4px 4px 0 #1a1a1a",
                      marginTop: -2,
                    }}>
                      {citySuggestions.map((s) => (
                        <div
                          key={s}
                          onMouseDown={() => {
                            setClinicCity(s);
                            setCityQuery(s);
                            setCitySuggestions([]);
                            setShowCitySuggestions(false);
                          }}
                          style={{
                            padding: "10px 16px",
                            fontSize: 14,
                            cursor: "pointer",
                            borderTop: "1px solid #f0f0f0",
                            color: "#1a1a1a",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f4ef")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button className="rc-btn" type="submit" disabled={loading}>
              {loading
                ? "⟳  Checking your clinic..."
                : "Check Your Clinic for Free →"}
            </button>
            <div className="rc-note">
              <span>100% Free</span>
              <span>No credit card</span>
              <span>Results in 30 seconds</span>
            </div>
            <div
              style={{
                marginTop: 16,
                padding: "10px 16px",
                background: "linear-gradient(135deg, #e8f4fd 0%, #f0faf8 100%)",
                border: "1px solid #b8e0f7",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 2px 8px rgba(14, 165, 233, 0.08)",
              }}
            >
              {/* Animated pulse dot */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#0ea5e9",
                    animation: "pulse 2s infinite",
                  }}
                />
                <style>{`
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.5); }
        70% { box-shadow: 0 0 0 7px rgba(14, 165, 233, 0); }
        100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
      }
    `}</style>
              </div>

              <span
                style={{
                  fontSize: 12,
                  color: "#0369a1",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}
              >
                🦷 <strong>Live intel for your practice</strong> — pulled fresh
                from Google Maps, patient reviews & website performance signals.
              </span>
            </div>
          </form>
        </div>

        {/* SCORE CARD */}
        <div className="rc-hero-visual">
          <div
            style={{
              background: "#0D0F0E",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 2,
                    color: "#1ABC9C",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Live Report
                </div>
                <div
                  style={{
                    fontFamily: "Playfair Display, serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#F7F3ED",
                    marginBottom: 2,
                  }}
                >
                  Downtown Dental Brooklyn
                </div>
                <div style={{ fontSize: 12, color: "rgba(247,243,237,0.45)" }}>
                  📍 Brooklyn, NY
                </div>
              </div>
              <div
                style={{
                  background: "#D4A843",
                  borderRadius: 12,
                  width: 52,
                  height: 52,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0D0F0E",
                    lineHeight: 1,
                  }}
                >
                  66
                </div>
                <div style={{ fontSize: 9, color: "#0D0F0E", fontWeight: 600 }}>
                  /100
                </div>
              </div>
            </div>

            {/* Metrics */}
            {[
              {
                label: "🧑‍⚕️ New Patients from Google",
                value: "Very Low",
                color: "#C0392B",
              },
              {
                label: "⭐ Google Reviews",
                value: "300 · 4.9 stars",
                color: "#1ABC9C",
              },
              {
                label: "⚡ Website Speed",
                value: "13/100 — Slow",
                color: "#C0392B",
              },
              {
                label: "🏆 Competitors Ahead",
                value: "3 outranking you",
                color: "#D4A843",
              },
              {
                label: "📩 Review Requests & Replies",
                value: "Automated ✓",
                color: "#1ABC9C",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "7px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ fontSize: 13, color: "rgba(247,243,237,0.6)" }}>
                  {item.label}
                </span>
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: item.color }}
                >
                  {item.value}
                </span>
              </div>
            ))}

            {/* Footer */}
            <div
              style={{
                marginTop: 16,
                background: "rgba(192,57,43,0.12)",
                border: "1px solid rgba(192,57,43,0.3)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 12, color: "#F7F3ED", lineHeight: 1.6 }}>
                🏆 Top clinic has{" "}
                <strong style={{ color: "#C0392B" }}>712 more reviews</strong>.
                <br />
                You&apos;re ranked{" "}
                <strong style={{ color: "#C0392B" }}>#5</strong> — top 3 gets
                70% of clicks.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="rc-stats">
        {[
          { num: "200K+", label: "Dental clinics in the USA" },
          { num: "78%", label: "Patients find dentists via Google" },
          { num: "3×", label: "More calls from page 1 ranking" },
          { num: "$0", label: "To get your free audit today" },
        ].map((s, i) => (
          <div key={s.num} style={{ display: "contents" }}>
            <div className="rc-stat">
              <span className="rc-stat-num">{s.num}</span>
              <div className="rc-stat-lbl">{s.label}</div>
            </div>
            {i < 3 && <div className="rc-divider" />}
          </div>
        ))}
      </div>

      {/* PROOF STATEMENT */}
      <div
        style={{
          textAlign: "center",
          padding: "20px 24px 0",
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <p
          style={{
            fontSize: 16,
            color: "var(--muted)",
            lineHeight: 1.8,
            fontStyle: "italic",
          }}
        >
          &ldquo;Clinics with more Google reviews appear higher on Google Maps
          and attract more new patient calls.&rdquo;
        </p>
      </div>

      {/* REVIEW AUTOMATION HIGHLIGHT */}
      <section
        style={{
          background: "var(--dark)",
          padding: "72px 24px",
          margin: "60px 0 0",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "flex",
            gap: 60,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: "#1ABC9C",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Review Automation
            </div>
            <h2
              style={{
                fontFamily: "Playfair Display, serif",
                fontSize: 32,
                fontWeight: 800,
                color: "#F7F3ED",
                marginBottom: 16,
                lineHeight: 1.3,
              }}
            >
              Turn happy patients into
              <br />
              5-star reviews automatically
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "rgba(247,243,237,0.55)",
                lineHeight: 1.8,
                marginBottom: 28,
              }}
            >
              Most dentists lose reviews because they never ask. RootCanal makes
              it effortless — send a direct Google review link to any patient in
              seconds.
            </p>
            {[
              "Send review request links to patients in seconds",
              "Track how many new reviews you gain each month",
              "Stay ahead of nearby clinics with more 5-star reviews",
              "Direct link opens Google review box instantly — no friction",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#1ABC9C",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#000",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <span style={{ fontSize: 14, color: "rgba(247,243,237,0.75)" }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 280,
              background: "#151918",
              borderRadius: 16,
              padding: 28,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: "#1ABC9C",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              Review Request
            </div>
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(247,243,237,0.5)",
                  marginBottom: 6,
                }}
              >
                Patient email or phone
              </div>
              <div
                style={{
                  background: "#0D0F0E",
                  border: "1px solid rgba(26,188,156,0.3)",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 14,
                  color: "rgba(247,243,237,0.4)",
                }}
              >
                patient@email.com
              </div>
            </div>
            <div
              style={{
                background: "#1ABC9C",
                borderRadius: 8,
                padding: "14px",
                textAlign: "center",
                fontWeight: 700,
                fontSize: 14,
                color: "#000",
                marginBottom: 20,
              }}
            >
              ⭐ Send Review Request →
            </div>
            <div
              style={{
                background: "rgba(46,204,113,0.08)",
                border: "1px solid rgba(46,204,113,0.2)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#2ECC71",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                🎉 Request sent!
              </div>
              <div style={{ fontSize: 12, color: "rgba(247,243,237,0.5)" }}>
                Patient receives a direct link to your Google review page. One
                click and they&apos;re writing a review.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="rc-section" id="how">
        <div className="rc-sec-label">How it works</div>
        <h2 className="rc-sec-title">
          Three steps to getting more patients from Google
        </h2>
        <div className="rc-steps">
          {[
            {
              num: "01",
              title: "Enter your website",
              desc: "Paste your dental clinic URL. We scan your entire online presence in under 60 seconds — no setup, no credit card required.",
            },
            {
              num: "02",
              title: "See what's broken",
              desc: "Get a clear score out of 100. We show you exactly what's missing, what's hurting your ranking, and how you compare to nearby competitors.",
            },
            {
              num: "03",
              title: "Fix it & grow",
              desc: "Follow our plain-English fix guides. We rescan your site every month and track your ranking improvement so you always know you're moving forward.",
            },
          ].map((s) => (
            <div key={s.num} className="rc-step fade-in">
              <div className="rc-step-num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEMS */}
      <section className="rc-problems">
        <div className="rc-sec-label" style={{ color: "var(--gold)" }}>
          Why clinics struggle
        </div>
        <h2 className="rc-sec-title" style={{ color: "var(--cream)" }}>
          Sound familiar?
        </h2>
        <div className="rc-problems-grid">
          {[
            {
              icon: "📍",
              title: '"Patients can\'t find us on Google"',
              desc: "You show up on page 3. Nobody clicks page 3. Your competitor down the road gets all the calls.",
            },
            {
              icon: "⭐",
              title: '"We only have 8 Google reviews"',
              desc: "Clinics with 50+ reviews rank higher and get more trust. You know you need more but don't know how to get them.",
            },
            {
              icon: "🌐",
              title: '"Our website looks outdated"',
              desc: "Your website was built 5 years ago. It loads slowly, doesn't work on phones, and Google penalizes you for it.",
            },
            {
              icon: "🤷",
              title: '"I don\'t know what SEO even means"',
              desc: "Every agency speaks in confusing jargon. You just want more patients calling — not a tech lesson.",
            },
          ].map((p) => (
            <div key={p.icon} className="rc-problem-card fade-in">
              <div className="rc-problem-icon">{p.icon}</div>
              <div>
                <h4>{p.title}</h4>
                <p>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="rc-section" id="features">
        <div className="rc-sec-label">What you get</div>
        <h2 className="rc-sec-title">Everything inside your free analysis</h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--muted)",
            maxWidth: 560,
            margin: "0 auto 60px",
            fontSize: 16,
            lineHeight: 1.7,
          }}
        >
          No jargon. No fluff. Just the data your clinic needs to rank higher
          and get more patients.
        </p>

        {/* FEATURE 1 — Competitor Gap */}
        <div
          style={{
            display: "flex",
            gap: 48,
            alignItems: "center",
            marginBottom: 80,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="rc-sec-label" style={{ display: "inline-flex" }}>
              🏆 Competitor Intelligence
            </div>
            <h3
              style={{
                fontSize: 26,
                fontWeight: 700,
                margin: "12px 0 16px",
                fontFamily: "Playfair Display, serif",
              }}
            >
              Find out exactly who&apos;s stealing your patients
            </h3>
            <p style={{ color: "var(--muted)", lineHeight: 1.8, fontSize: 15 }}>
              We identify the top 3 clinics outranking you, show their exact
              review count, rating, and score — then give you the single most
              important action to close the gap.{" "}
              <strong style={{ color: "var(--dark)" }}>
                Pro members get this updated every month.
              </strong>
            </p>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 280,
              background: "#0D0F0E",
              borderRadius: 16,
              padding: 24,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: "#1ABC9C",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              You vs. Top Competitor
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  background: "rgba(26,188,156,0.1)",
                  border: "1px solid rgba(26,188,156,0.3)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(247,243,237,0.5)",
                    marginBottom: 8,
                  }}
                >
                  YOUR CLINIC
                </div>
                <div
                  style={{ fontSize: 22, fontWeight: 800, color: "#1ABC9C" }}
                >
                  4.9 ⭐
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(247,243,237,0.5)",
                    marginTop: 4,
                  }}
                >
                  300 reviews
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(247,243,237,0.3)",
                  fontWeight: 700,
                }}
              >
                VS
              </div>
              <div
                style={{
                  background: "rgba(192,57,43,0.1)",
                  border: "1px solid rgba(192,57,43,0.3)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(247,243,237,0.5)",
                    marginBottom: 8,
                  }}
                >
                  TOP CLINIC
                </div>
                <div
                  style={{ fontSize: 22, fontWeight: 800, color: "#C0392B" }}
                >
                  5.0 ⭐
                </div>
                <div style={{ fontSize: 12, color: "#C0392B", marginTop: 4 }}>
                  712 more
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                background: "rgba(192,57,43,0.1)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#F7F3ED",
              }}
            >
              🎯 <strong>Biggest opportunity:</strong> Get 412 more reviews to
              match the top clinic in Brooklyn, NY.
            </div>
          </div>
        </div>

        {/* FEATURE 2 — Growth Roadmap */}
        <div
          style={{
            display: "flex",
            gap: 48,
            alignItems: "center",
            marginBottom: 80,
            flexWrap: "wrap",
            flexDirection: "row-reverse",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="rc-sec-label" style={{ display: "inline-flex" }}>
              🗺️ Growth Roadmap
            </div>
            <h3
              style={{
                fontSize: 26,
                fontWeight: 700,
                margin: "12px 0 16px",
                fontFamily: "Playfair Display, serif",
              }}
            >
              Your personal GPS to the #1 spot in your city
            </h3>
            <p style={{ color: "var(--muted)", lineHeight: 1.8, fontSize: 15 }}>
              We name the exact competitors to overtake, in order, with
              estimated timelines. You&apos;ll know your next move every single
              month. No agency needed, no guesswork — just a clear path from
              where you are to #1.
            </p>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 280,
              background: "#0D0F0E",
              borderRadius: 16,
              padding: 24,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: "#D4A843",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Your Growth Roadmap
            </div>
            {[
              {
                step: 1,
                name: "Overtake Expert Dental",
                tag: "NEXT TARGET",
                score: 79,
                weeks: "3–4 weeks",
                active: true,
              },
              {
                step: 2,
                name: "Overtake Sky Dental",
                tag: null,
                score: 88,
                weeks: null,
                active: false,
              },
              {
                step: 3,
                name: "Overtake 209 NYC Dental",
                tag: null,
                score: 95,
                weeks: null,
                active: false,
              },
            ].map((r) => (
              <div
                key={r.step}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 8,
                  marginBottom: 8,
                  background: r.active
                    ? "rgba(212,168,67,0.1)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${r.active ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.06)"}`,
                  opacity: r.active ? 1 : 0.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: r.active
                        ? "#D4A843"
                        : "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: r.active ? "#0D0F0E" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {r.active ? r.step : "🔒"}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#F7F3ED",
                        fontWeight: 600,
                      }}
                    >
                      {r.name}
                    </div>
                    {r.active && (
                      <div
                        style={{ fontSize: 11, color: "#D4A843", marginTop: 2 }}
                      >
                        est. {r.weeks}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: r.active ? "#D4A843" : "rgba(255,255,255,0.3)",
                  }}
                >
                  Score: {r.score}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FEATURE 3 — Reviews */}
        <div
          style={{
            display: "flex",
            gap: 48,
            alignItems: "center",
            marginBottom: 80,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="rc-sec-label" style={{ display: "inline-flex" }}>
              ⭐ Review Automation
            </div>
            <h3
              style={{
                fontSize: 26,
                fontWeight: 700,
                margin: "12px 0 16px",
                fontFamily: "Playfair Display, serif",
              }}
            >
              Get more 5-star reviews — and respond to every one automatically
            </h3>
            <p style={{ color: "var(--muted)", lineHeight: 1.8, fontSize: 15 }}>
              Send a direct Google review link to any patient in 2 clicks. When
              a new review comes in, our AI reads the sentiment and drafts a
              reply — a warm thank you for positive reviews, a professional
              apology for negative ones. You can customise the tone, or let it
              post automatically.
            </p>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 280,
              background: "#0D0F0E",
              borderRadius: 16,
              padding: 24,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: "#D4A843",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              AI Review Analysis
            </div>
            {[
              {
                label: "💚 Patients Love",
                items: [
                  "Gentle & painless treatment",
                  "Friendly staff",
                  "Easy scheduling",
                ],
              },
              {
                label: "🔴 Top Complaint",
                items: ["Long wait times at front desk"],
              },
              {
                label: "⚡ Fix This First",
                items: ["Add online check-in to reduce wait times"],
              },
            ].map((section) => (
              <div key={section.label} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "rgba(247,243,237,0.7)",
                    marginBottom: 6,
                  }}
                >
                  {section.label}
                </div>
                {section.items.map((item) => (
                  <div
                    key={item}
                    style={{
                      fontSize: 13,
                      color: "rgba(247,243,237,0.5)",
                      padding: "4px 0",
                      paddingLeft: 12,
                      borderLeft: "2px solid rgba(26,188,156,0.4)",
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            ))}
            <div
              style={{
                marginTop: 12,
                background: "rgba(26,188,156,0.08)",
                border: "1px solid rgba(26,188,156,0.2)",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "rgba(247,243,237,0.5)", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>AI Reply drafted</div>
              <div style={{ fontSize: 12, color: "rgba(247,243,237,0.75)", lineHeight: 1.6, marginBottom: 8 }}>
                &ldquo;Thank you so much for the kind words! We&apos;re thrilled you had a great experience at our clinic.&rdquo;
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "#1ABC9C", borderRadius: 6, padding: "6px 10px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#000", cursor: "pointer" }}>Post Reply</div>
                <div style={{ flex: 1, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", textAlign: "center", fontSize: 11, color: "rgba(247,243,237,0.5)", cursor: "pointer" }}>Edit</div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 4 — Health Checklist */}
        <div
          style={{
            display: "flex",
            gap: 48,
            alignItems: "center",
            flexWrap: "wrap",
            flexDirection: "row-reverse",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="rc-sec-label" style={{ display: "inline-flex" }}>
              🔧 Website Health
            </div>
            <h3
              style={{
                fontSize: 26,
                fontWeight: 700,
                margin: "12px 0 16px",
                fontFamily: "Playfair Display, serif",
              }}
            >
              Every issue found. Every fix explained.
            </h3>
            <p style={{ color: "var(--muted)", lineHeight: 1.8, fontSize: 15 }}>
              We scan your website for every factor Google uses to rank dentists
              — speed, SEO, mobile, accessibility. For each problem we find, we
              explain exactly how to fix it in plain English. Forward it to your
              web developer and it&apos;s done.
            </p>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 280,
              background: "#0D0F0E",
              borderRadius: 16,
              padding: 24,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: "#1ABC9C",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Website Health Checklist
            </div>
            {[
              {
                icon: "❌",
                label: "Page speed critically slow (13/100)",
                color: "#C0392B",
              },
              {
                icon: "❌",
                label: "Missing title tags on 3 pages",
                color: "#C0392B",
              },
              {
                icon: "⚠️",
                label: "Google Business hours incomplete",
                color: "#D4A843",
              },
              {
                icon: "✅",
                label: "Mobile friendly — Great",
                color: "#1ABC9C",
              },
              { icon: "✅", label: "SSL certificate active", color: "#1ABC9C" },
              {
                icon: "✅",
                label: "Google Business profile found",
                color: "#1ABC9C",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  fontSize: 13,
                }}
              >
                <span>{item.icon}</span>
                <span style={{ color: item.color }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="rc-footer">
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 18,
            fontWeight: 900,
            color: "#F7F3ED",
          }}
        >
          Root<span style={{ color: "var(--red)" }}>Canal</span>
        </div>
        <div>
          © 2026 RootCanal. Built for dental clinics who want more patients.
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="/privacy-policy">Privacy</a>
          <a href="/terms-and-conditions">Terms</a>
          <a href="mailto:hello@rootcanal.app">Contact</a>
        </div>
      </footer>

      <script
        dangerouslySetInnerHTML={{
          __html: `
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((e, i) => {
            if (e.isIntersecting) setTimeout(() => e.target.classList.add('visible'), i * 100);
          });
        }, { threshold: 0.1 });
        document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
      `,
        }}
      />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
