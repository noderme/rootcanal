const N = 5;

export interface RankStats {
  rawRank: number;
  smoothedRank: number;
  rankRangeLow: number;
  rankRangeHigh: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Compute smoothed rank stats from the current raw rank and prior historical samples.
 * historicalRanks should be the previous N-1 samples (oldest→newest), NOT including current.
 */
export function computeRankStats(
  rawRank: number,
  historicalRanks: number[],
): RankStats {
  const samples = [...historicalRanks.slice(-(N - 1)), rawRank];

  let smoothedRank: number;
  if (samples.length === 1) {
    smoothedRank = rawRank;
  } else if (samples.length < N) {
    smoothedRank = Math.round(
      samples.reduce((a, b) => a + b, 0) / samples.length,
    );
  } else {
    smoothedRank = median(samples);
  }

  return {
    rawRank,
    smoothedRank,
    rankRangeLow: Math.min(...samples),
    rankRangeHigh: Math.max(...samples),
  };
}
