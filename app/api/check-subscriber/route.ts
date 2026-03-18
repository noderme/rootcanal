import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const clinicUrl = searchParams.get("url");

  try {
    let query = supabase
      .from("subscribers")
      .select("email, plan, status")
      .in("status", ["active", "trialing"]);

    if (clinicUrl) {
      query = query.eq("clinic_url", clinicUrl);
    } else if (email) {
      query = query.eq("email", email.toLowerCase().trim());
    } else {
      return NextResponse.json({ found: false });
    }

    const { data } = await query.single();
    if (data) {
      return NextResponse.json({ found: true, plan: data.plan, status: data.status, email: data.email });
    }
    return NextResponse.json({ found: false });
  } catch {
    return NextResponse.json({ found: false });
  }
}
