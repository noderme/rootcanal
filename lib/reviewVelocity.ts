import { SupabaseClient } from "@supabase/supabase-js";

export interface ReviewVelocity {
  gained: number;
  days: number;
}

/**
 * Returns how many reviews a clinic gained over approximately the last [days] days,
 * comparing the two most recent snapshots that are at least [days] apart.
 * Returns null if there is not enough snapshot history yet.
 */
export async function getReviewVelocity(
  supabase: SupabaseClient,
  clinicUrl: string,
  days = 30,
): Promise<ReviewVelocity | null> {
  // Most recent snapshot
  const { data: recent } = await supabase
    .from("review_snapshots")
    .select("review_count, snapshot_date")
    .eq("clinic_url", clinicUrl)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (!recent || recent.review_count == null) return null;

  // Cutoff: [days] days before the most recent snapshot
  const recentDate = new Date(recent.snapshot_date);
  const cutoff = new Date(recentDate);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Most recent snapshot that is at least [days] before the recent one
  const { data: older } = await supabase
    .from("review_snapshots")
    .select("review_count, snapshot_date")
    .eq("clinic_url", clinicUrl)
    .lte("snapshot_date", cutoffStr)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (!older || older.review_count == null) return null;

  const gained = recent.review_count - older.review_count;
  const olderDate = new Date(older.snapshot_date);
  const diffDays = Math.round(
    (recentDate.getTime() - olderDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return { gained, days: diffDays };
}
