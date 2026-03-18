/**
 * Lightweight competitor observation history.
 *
 * Stored in Supabase table `competitor_history` — one row per clinic.
 * Create with:
 *
 *   CREATE TABLE competitor_history (
 *     clinic_key   text        PRIMARY KEY,
 *     city         text,
 *     competitors  jsonb       NOT NULL DEFAULT '[]',
 *     updated_at   timestamptz NOT NULL DEFAULT now()
 *   );
 *
 * No RLS required beyond what the scans table already uses.
 */

// Max observed positions to retain per competitor (keeps the row size bounded)
const MAX_POSITIONS = 10;

export interface CompetitorObservation {
  name: string;
  normalizedName: string;  // lowercase + trimmed — used as stable match key
  placeId?: string;        // populated if available in future
  positions: number[];     // last MAX_POSITIONS observed googleRank values
  firstSeen: string;       // ISO 8601
  lastSeen: string;        // ISO 8601
  appearances: number;     // total scan count this competitor has been seen in
}

export type CompetitorHistory = CompetitorObservation[];

/**
 * Merge the competitors from a single scan into the existing history.
 * Returns a new array — does not mutate inputs.
 */
export function mergeCompetitorHistory(
  existing: CompetitorHistory,
  currentCompetitors: { name: string; googleRank: number; placeId?: string }[],
  now: string, // ISO 8601
): CompetitorHistory {
  // Index existing entries by normalizedName for O(1) lookup
  const byName = new Map<string, CompetitorObservation>(
    existing.map((e) => [e.normalizedName, { ...e, positions: [...e.positions] }]),
  );

  for (const c of currentCompetitors) {
    const key = (c.name ?? "").toLowerCase().trim();
    if (!key) continue;

    const existing = byName.get(key);
    if (existing) {
      existing.positions = [
        ...existing.positions.slice(-(MAX_POSITIONS - 1)),
        c.googleRank,
      ];
      existing.lastSeen = now;
      existing.appearances += 1;
      if (c.placeId && !existing.placeId) existing.placeId = c.placeId;
    } else {
      byName.set(key, {
        name: c.name,
        normalizedName: key,
        placeId: c.placeId,
        positions: [c.googleRank],
        firstSeen: now,
        lastSeen: now,
        appearances: 1,
      });
    }
  }

  return Array.from(byName.values());
}

/**
 * Derive a stable average position for a competitor from their history.
 * Returns null if fewer than 2 observations.
 */
export function stablePosition(obs: CompetitorObservation): number | null {
  if (obs.positions.length < 2) return null;
  const sum = obs.positions.reduce((a, b) => a + b, 0);
  return Math.round(sum / obs.positions.length);
}
