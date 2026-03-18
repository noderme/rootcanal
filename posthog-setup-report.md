<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into RootCanal. Client-side tracking is initialized via `instrumentation-client.ts` (Next.js 15.3+ pattern) with automatic exception capture and a reverse proxy through `/ingest`. Server-side tracking uses `posthog-node` via a shared `lib/posthog-server.ts` client, covering all critical Paddle payment webhooks, review request dispatch, user login, and audit completion. Nine events were instrumented across seven files.

| Event | Description | File |
|---|---|---|
| `audit_submitted` | User submits the landing page audit form (by URL or clinic name+city) | `app/page.tsx` |
| `upgrade_modal_opened` | User opens the upgrade/pricing modal in the dashboard | `app/dashboard/page.tsx` |
| `plan_selected` | User selects a plan (pro/growth) and opens Paddle checkout | `app/dashboard/page.tsx` |
| `plan_activated` | Plan saved to Supabase after client-side Paddle checkout | `app/api/activate-plan/route.ts` |
| `subscription_created` | Paddle webhook confirms new/updated subscription | `app/api/paddle-webhook/route.ts` |
| `subscription_cancelled` | Paddle webhook confirms subscription cancellation | `app/api/paddle-webhook/route.ts` |
| `review_request_sent` | Review request sent to patient via email or SMS | `app/api/request-review/route.ts` |
| `login_otp_sent` | User identified in leads table; OTP dispatched via Supabase | `app/api/lookup-user/route.ts` |
| `audit_completed` | Full audit finished and result returned to client | `app/api/audit/route.ts` |

**New files created:**
- `instrumentation-client.ts` — client-side PostHog init with exception capture
- `lib/posthog-server.ts` — server-side PostHog singleton client

**Config updated:**
- `next.config.ts` — PostHog reverse proxy rewrites added
- `.env.local` — `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` set

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/347422/dashboard/1373436
- **Audit-to-Subscription Conversion Funnel:** https://us.posthog.com/project/347422/insights/kOCdygaT
- **Subscriptions Created vs Cancelled (Weekly):** https://us.posthog.com/project/347422/insights/Vckxkjuy
- **Review Requests Sent (Weekly):** https://us.posthog.com/project/347422/insights/dadLxWSZ
- **Audit Submissions (Daily):** https://us.posthog.com/project/347422/insights/7JsKsKTX
- **Audit Completion Rate:** https://us.posthog.com/project/347422/insights/h299bEuZ

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
