"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [url, setUrl] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch city suggestions from Google Places API
  const fetchCitySuggestions = async (input: string) => {
    if (input.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/cities?input=${encodeURIComponent(input)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCity(val);
    fetchCitySuggestions(val);
  };

  const selectCity = (suggestion: string) => {
    setCity(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !city) return;
    setLoading(true);
    // Clean URL — accept any format dentist types
    let cleanUrl = url.trim().toLowerCase();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }
    router.push(
      `/dashboard?url=${encodeURIComponent(cleanUrl)}&city=${encodeURIComponent(city)}`,
    );
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
        .rc-hero { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; padding: 120px 60px 80px; gap: 60px; align-items: center; position: relative; overflow: hidden; }
        .rc-hero::before { content: ''; position: absolute; top: -100px; right: -100px; width: 600px; height: 600px; background: radial-gradient(circle, rgba(192,57,43,0.08) 0%, transparent 70%); pointer-events: none; }
        .rc-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--red); margin-bottom: 24px; }
        .rc-eyebrow::before { content: ''; width: 24px; height: 2px; background: var(--red); }
        .rc-h1 { font-family: 'Playfair Display', serif; font-size: clamp(42px, 5vw, 68px); font-weight: 900; line-height: 1.05; letter-spacing: -2px; color: var(--dark); margin-bottom: 24px; }
        .rc-h1 em { font-style: italic; color: var(--red); }
        .rc-sub { font-size: 18px; line-height: 1.7; color: var(--muted); max-width: 480px; margin-bottom: 40px; font-weight: 300; }
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
        <a href="/" className="rc-logo">
          Root<span>Canal</span>
        </a>
        <div className="rc-nav-links">
          <a href="#how" className="rc-nav-link">
            How it works
          </a>
          <a href="#features" className="rc-nav-link">
            Features
          </a>
          <a href="#pricing" className="rc-nav-link">
            Pricing
          </a>
          <a href="#audit" className="rc-nav-link rc-nav-cta">
            Free Audit →
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="rc-hero">
        <div>
          <div className="rc-eyebrow">
            Free Google Ranking Report for Dental Clinics
          </div>
          <h1 className="rc-h1">
            Find Out How Many Patients
            <br />
            Your Clinic Is <em>Losing.</em>
          </h1>
          <p className="rc-sub">
            See your dental clinic&apos;s Google ranking, patient review
            insights, and website problems — in 30 seconds. No tech knowledge
            needed.
          </p>

          <form id="audit" onSubmit={handleSubmit} className="rc-form-wrap">
            <div className="rc-scan-box">
              <input
                className="rc-input"
                type="text"
                placeholder="e.g. smilesdental.com or www.smilesdental.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div className="rc-city-wrap" ref={cityRef}>
              <div className="rc-scan-box">
                <input
                  className="rc-input"
                  type="text"
                  placeholder="Your city (e.g. Austin, Texas)…"
                  value={city}
                  onChange={handleCityChange}
                  onFocus={() =>
                    suggestions.length > 0 && setShowSuggestions(true)
                  }
                  autoComplete="off"
                  required
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="rc-suggestions">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="rc-suggestion-item"
                      onClick={() => selectCity(s)}
                    >
                      <span className="rc-suggestion-pin">📍</span>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="rc-btn" type="submit" disabled={loading}>
              {loading
                ? "⟳  Checking your clinic..."
                : "Check Your Clinic for Free →"}
            </button>
            <div className="rc-note">
              <span>100% Free</span>
              <span>No credit card</span>
              <span>Results in 60 seconds</span>
            </div>
          </form>
        </div>

        {/* SCORE CARD */}
        <div className="rc-hero-visual">
          <div className="rc-score-card">
            <div className="rc-score-header">
              <div>
                <div className="rc-score-label">Google Ranking Report</div>
                <div className="rc-clinic-name">Bright Smile Dental</div>
                <div className="rc-clinic-loc">📍 Austin, Texas</div>
              </div>
              <div className="rc-score-badge">43</div>
            </div>
            {[
              {
                dot: "dot-red",
                label: "Google Business Profile",
                status: "Incomplete",
                cls: "bad",
              },
              {
                dot: "dot-red",
                label: "Local Keywords",
                status: "Missing",
                cls: "bad",
              },
              {
                dot: "dot-gold",
                label: "Website Speed",
                status: "Needs Work",
                cls: "warn",
              },
              {
                dot: "dot-red",
                label: "Google Reviews",
                status: "Only 8",
                cls: "bad",
              },
              {
                dot: "dot-green",
                label: "Mobile Friendly",
                status: "Great ✓",
                cls: "good",
              },
            ].map((item) => (
              <div key={item.label} className="rc-score-item">
                <div className="rc-item-left">
                  <div className={`rc-dot ${item.dot}`} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {item.label}
                  </span>
                </div>
                <span className={`rc-badge ${item.cls}`}>{item.status}</span>
              </div>
            ))}
            <div className="rc-card-footer">
              Competitor <strong>Dr. Smith</strong> ranks #1 in Austin.
              <br />
              You&apos;re ranked <strong>#7</strong>. Here&apos;s how to catch
              up →
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
        <h2 className="rc-sec-title">
          Everything your clinic needs to get more patients
        </h2>
        <div className="rc-features-grid">
          {[
            {
              icon: "🔍",
              title: "Google Ranking Check",
              desc: "We check 30+ things Google looks at: speed, mobile, keywords, and more. Score out of 100 in plain English.",
            },
            {
              icon: "📍",
              title: "Google Profile Checker",
              desc: "We check if your Google Business Profile is complete and tell you exactly what to add to rank higher in local searches.",
            },
            {
              icon: "👁️",
              title: "See Who's Beating You",
              desc: "See how you stack up against 3 nearby dental clinics. Get alerted when a competitor overtakes you so you can act fast.",
            },
            {
              icon: "⭐",
              title: "Get More Reviews Automatically",
              desc: "Automatically send happy patients a review request via SMS or email after their appointment. More reviews = higher ranking.",
            },
            {
              icon: "📊",
              title: "Monthly Progress Updates",
              desc: "A simple one-page report every month showing your score improvement, new reviews, and ranking changes. No jargon.",
            },
            {
              icon: "🔧",
              title: "Simple Fix Instructions",
              desc: "For every problem we find, we give you simple steps to fix it — or share with your web developer.",
            },
          ].map((f) => (
            <div key={f.title} className="rc-feature-card fade-in">
              <span className="rc-feature-icon">{f.icon}</span>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="rc-pricing" id="pricing">
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div
            className="rc-sec-label"
            style={{ display: "flex", justifyContent: "center" }}
          >
            Pricing
          </div>
          <h2
            className="rc-sec-title"
            style={{ margin: "0 auto", textAlign: "center" }}
          >
            Simple, honest pricing
          </h2>
        </div>
        <div className="rc-pricing-grid">
          {[
            {
              plan: "Starter",
              price: "$0",
              period: "forever free",
              features: [
                "One-time SEO audit",
                "Score out of 100",
                "Top 5 issues identified",
                "Basic fix suggestions",
              ],
              featured: false,
            },
            {
              plan: "Pro",
              price: "$49",
              period: "per month",
              features: [
                "Monthly automated checks",
                "Full 30-point Google report",
                "Competitor tracking (3 clinics)",
                "Review request automation",
                "Monthly progress report",
                "Step-by-step fix guides",
              ],
              featured: true,
            },
            {
              plan: "Growth",
              price: "$99",
              period: "per month",
              features: [
                "Everything in Pro",
                "Competitor tracking (10 clinics)",
                "Google Ads automation",
                "Priority email support",
                "Quarterly strategy call",
              ],
              featured: false,
            },
          ].map((p) => (
            <div
              key={p.plan}
              className={`rc-pricing-card${p.featured ? " featured" : ""}`}
            >
              {p.featured && (
                <div className="rc-pricing-badge">Most Popular</div>
              )}
              <div className="rc-pricing-plan">{p.plan}</div>
              <div className="rc-pricing-price">{p.price}</div>
              <div className="rc-pricing-period">{p.period}</div>
              <ul className="rc-pricing-features">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <a href="#audit" className="rc-pricing-btn">
                {p.price === "$0" ? "Get Free Audit" : "Start Free Trial"}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rc-cta-section">
        <h2>
          Your competitor is ranking #1.
          <br />
          Are you?
        </h2>
        <p>
          Get your free dental SEO audit in 60 seconds. No credit card. No
          jargon. Just results.
        </p>
        <form className="rc-cta-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="e.g. smilesdental.com or www.smilesdental.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button type="submit">Check Your Clinic for Free →</button>
        </form>
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
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
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
