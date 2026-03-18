# RootCanal

**Dental growth intelligence platform.** RootCanal audits dental clinic websites and Google Business Profiles, benchmarks clinics against local competitors, and helps dentists get more reviews — all in under 30 seconds.

Live at [rootcanal.us](https://rootcanal.us)

---

## What It Does

- **Instant audit** — enter your clinic website or just your Google Business name + city to get a full competitive report
- **Google & Yelp rank** — see where you rank among dentists within 5 km
- **Competitor intelligence** — compare ratings, reviews, and scores against nearby clinics
- **AI review analysis** — Claude AI summarizes what patients love, complain about, and what to fix first
- **Growth roadmap** — step-by-step plan to overtake competitors, with time estimates
- **Review automation** — send Google or Yelp review request emails and SMS to patients
- **Website health** — PageSpeed performance, SEO, accessibility, SSL, mobile, metadata scores

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Frontend | React 19, inline styles |
| Database | Supabase (PostgreSQL + Auth) |
| Payments | Paddle (subscriptions + webhooks) |
| Deployment | Vercel (serverless) |
| Email | Resend |
| SMS | Twilio |
| Analytics | Contentsquare |
| PWA | Service Worker + Web Manifest |

---

## External APIs

| Service | Purpose |
|---------|---------|
| Google Maps Platform | Places search, clinic/city detection, competitor nearbysearch, PageSpeed scores |
| SerpAPI | Google Maps local rank detection, Yelp business search + reviews |
| Apify | Google Maps reviews scraper (50 reviews, Pro/Growth), Healthgrades scraper |
| Anthropic Claude API | AI analysis of combined Google + Yelp reviews |

---

## Plan Tiers

| Feature | Free | Pro | Growth |
|---------|------|-----|--------|
| Audit report | Basic | Full 30-point | Full 30-point |
| Google reviews | 5 | 50 | 50 (last 3 months) |
| Yelp reviews | 5 | 50 | 50 (last 3 months) |
| AI review analysis | — | Yes | Yes |
| Competitor cards | 2 | 7 | 7 |
| Roadmap steps | 1 | All | All |
| Review request email | — | Google + Yelp | Google + Yelp |
| Review request SMS | — | Google + Yelp | Google + Yelp |
| Healthgrades lookup | — | Yes | Yes |

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/audit` | GET | Full clinic audit — PageSpeed, GBP, competitors, Yelp, Healthgrades |
| `/api/audit-lite` | GET | Fast audit (PageSpeed + competitors only, ~3s) |
| `/api/reviews` | GET | Fetch Google + Yelp reviews with Claude AI sentiment analysis |
| `/api/request-review` | POST | Send review request via email (Resend) or SMS (Twilio) |
| `/api/activate-plan` | POST | Activate Pro/Growth plan in Supabase after Paddle checkout |
| `/api/paddle-webhook` | POST | Receive Paddle subscription events |
| `/api/start-trial` | POST | Create 7-day trial record in Supabase |
| `/api/trial-welcome` | POST | Send trial welcome email via Resend |
| `/api/lookup-user` | GET | Find subscriber by clinic URL, send OTP |
| `/api/cities` | GET | Google Places city autocomplete (US only) |
| `/api/webhooks/supabase-trial` | POST | Supabase DB webhook — sends welcome email on trial INSERT |

**Audit accepts two modes:**
- Website mode: `?url=https://smilesdental.com`
- GBP-only mode: `?name=Smiles+Dental&city=Austin,+TX`

---

## Trial Email Flow

When a subscriber starts a trial, the following emails fire automatically:

| Trigger | Email | Sent by |
|---------|-------|---------|
| INSERT into `subscribers` (plan=trial) | Welcome email | Supabase DB webhook → `/api/webhooks/supabase-trial` |
| Day 3 of trial | Nurture email | Scraper repo `day-marker.js` (midnight UTC) |
| Day 7 of trial | Expiry email + status → expired | Scraper repo `day-marker.js` (midnight UTC) |

The Supabase webhook fires on INSERT only — duplicate welcome emails are not possible.

---

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `scans` | Cached audit results (24-hour TTL) |
| `subscribers` | Subscribers and trial users — plan, status, trial dates, email sent timestamps |
| `review_requests` | Audit trail of sent review request emails/SMS |

---

## Project Structure

```
app/
├── page.tsx              # Landing page (website or GBP-only input)
├── dashboard/
│   └── page.tsx          # Main dashboard (competitors, roadmap, reviews, health)
├── api/
│   ├── audit/            # Full clinic audit
│   ├── audit-lite/       # Fast audit
│   ├── reviews/          # Google + Yelp reviews + AI analysis
│   ├── request-review/   # Email/SMS review requests
│   ├── activate-plan/    # Plan activation
│   ├── paddle-webhook/   # Payment webhooks
│   ├── start-trial/      # Trial creation
│   ├── trial-welcome/    # Trial welcome email
│   ├── lookup-user/      # User OTP flow
│   ├── cities/           # City autocomplete
│   └── webhooks/
│       └── supabase-trial/  # DB webhook handler for welcome email
├── layout.tsx            # Root layout (Paddle, Contentsquare, PWA)
└── privacy-policy/
    terms-and-conditions/
    refund-policy/

lib/
└── paddle.ts             # Paddle checkout helpers

public/
├── favicon.svg
├── manifest.json
└── sw.js                 # Service worker (PWA)
```

---

## Environment Variables

**Public (client-side):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_PADDLE_PRO_PRICE_ID
NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
```

**Server-only:**
```
GOOGLE_API_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_WEBHOOK_SECRET
ANTHROPIC_API_KEY
RESEND_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
APIFY_API_KEY
SERPAPI_KEY
PADDLE_API_KEY
```

---

## Local Development

```bash
npm install
npm run dev
```

Create `.env.local` and fill in all environment variables listed above.

---

## Deployment

Deployed on Vercel. Every push to `main` triggers an automatic production deployment.

```bash
npm run build   # verify build passes locally before pushing
git push origin main
```

---

## Related

- **Scraper / lead gen pipeline** — finds dental clinic emails, sends cold outreach, and manages trial lifecycle emails. Shares the same Supabase instance. Runs on a DigitalOcean server via PM2.
