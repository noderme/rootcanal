import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPostHogClient } from "@/lib/posthog-server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function normalizeDomain(url: string): string {
  return url
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\/$/, "")
    .trim();
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user[0]}***@${domain}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ found: false });

  const inputDomain = normalizeDomain(url);

  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("email, url")
    .not("email", "is", null);

  if (!leads?.length) return NextResponse.json({ found: false });

  const match = leads.find(
    (lead) => lead.url && normalizeDomain(lead.url) === inputDomain
  );

  if (!match) return NextResponse.json({ found: false });

  // Send OTP server-side — never expose email to client
  await supabaseAnon.auth.signInWithOtp({
    email: match.email,
    options: { shouldCreateUser: true, emailRedirectTo: undefined },
  });

  const posthog = getPostHogClient();
  posthog.identify({ distinctId: match.email, properties: { email: match.email, clinic_url: match.url } });
  posthog.capture({ distinctId: match.email, event: "login_otp_sent", properties: { clinic_url: url } });
  await posthog.shutdown();

  return NextResponse.json({ found: true, email: match.email, maskedEmail: maskEmail(match.email) });
}
