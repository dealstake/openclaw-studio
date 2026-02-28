/**
 * Practice scoring — extract scores from AI evaluator responses,
 * compute aggregates, and track improvement over time.
 */

import type { PracticeScore, PracticeMetrics, ScoringDimension } from "./personaTypes";
import type { PracticeSession, PracticeHistory } from "./practiceTypes";

// ---------------------------------------------------------------------------
// Score Extraction
// ---------------------------------------------------------------------------

/**
 * Extract a PracticeScore from an AI evaluator response.
 * Looks for a ```json:practice-score``` block and parses it.
 */
export function extractPracticeScore(
  evaluatorResponse: string,
  dimensions: ScoringDimension[],
): PracticeScore | null {
  // Try json:practice-score block first
  const blockMatch = evaluatorResponse.match(
    /```json:practice-score\s*\n([\s\S]*?)\n```/,
  );
  // Fall back to generic json block
  const genericMatch =
    !blockMatch &&
    evaluatorResponse.match(/```json\s*\n([\s\S]*?)\n```/);
  const jsonStr = blockMatch?.[1] ?? (genericMatch ? genericMatch[1] : undefined);

  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr) as {
      overall?: number;
      dimensions?: Record<string, number>;
      feedback?: string;
      improvements?: string[];
    };

    if (
      typeof parsed.overall !== "number" ||
      !parsed.dimensions ||
      typeof parsed.feedback !== "string"
    ) {
      return null;
    }

    // Clamp scores to 1-10 range
    const clamp = (n: number): number => Math.max(1, Math.min(10, Math.round(n)));

    const dimensionScores: Record<string, number> = {};
    for (const dim of dimensions) {
      const raw = parsed.dimensions[dim.key];
      dimensionScores[dim.key] = typeof raw === "number" ? clamp(raw) : 5;
    }

    return {
      timestamp: new Date().toISOString(),
      overall: clamp(parsed.overall),
      dimensions: dimensionScores,
      feedback: parsed.feedback,
      improvements: Array.isArray(parsed.improvements)
        ? parsed.improvements.filter((s): s is string => typeof s === "string")
        : [],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Aggregate Scoring
// ---------------------------------------------------------------------------

/**
 * Compute weighted overall score from dimension scores.
 */
export function computeWeightedScore(
  dimensionScores: Record<string, number>,
  dimensions: ScoringDimension[],
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of dimensions) {
    const score = dimensionScores[dim.key];
    if (typeof score === "number") {
      weightedSum += score * dim.weight;
      totalWeight += dim.weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

/**
 * Compute aggregate PracticeMetrics from a list of scores.
 */
export function computePracticeMetrics(
  scores: PracticeScore[],
  dimensions: ScoringDimension[],
): PracticeMetrics {
  if (scores.length === 0) {
    return {
      sessionCount: 0,
      averageScore: 0,
      bestScore: 0,
      trend: 0,
      dimensionAverages: {},
      lastPracticedAt: null,
    };
  }

  const overalls = scores.map((s) => s.overall);
  const averageScore =
    Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10;
  const bestScore = Math.max(...overalls);

  // Dimension averages
  const dimSums: Record<string, number> = {};
  const dimCounts: Record<string, number> = {};
  for (const score of scores) {
    for (const [key, val] of Object.entries(score.dimensions)) {
      dimSums[key] = (dimSums[key] ?? 0) + val;
      dimCounts[key] = (dimCounts[key] ?? 0) + 1;
    }
  }
  const dimensionAverages: Record<string, number> = {};
  for (const dim of dimensions) {
    if (dimCounts[dim.key]) {
      dimensionAverages[dim.key] =
        Math.round((dimSums[dim.key] / dimCounts[dim.key]) * 10) / 10;
    }
  }

  // Trend: linear regression slope on overall scores (normalized to -1..1)
  const trend = computeTrend(overalls);

  // Sort by timestamp descending to find latest
  const sorted = [...scores].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return {
    sessionCount: scores.length,
    averageScore,
    bestScore,
    trend,
    dimensionAverages,
    lastPracticedAt: sorted[0].timestamp,
  };
}

// ---------------------------------------------------------------------------
// Improvement Tracking
// ---------------------------------------------------------------------------

/**
 * Compute a linear trend from a series of scores.
 * Returns a value between -1 (declining) and 1 (improving).
 * Uses simple linear regression slope, normalized.
 */
export function computeTrend(scores: number[]): number {
  if (scores.length < 2) return 0;

  const n = scores.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += scores[i];
    sumXY += i * scores[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator;

  // Normalize: max possible slope over 10 sessions with scores 1-10 is ~1
  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, slope));
}

/**
 * Build a PracticeHistory summary from completed sessions.
 */
export function buildPracticeHistory(
  sessions: PracticeSession[],
  dimensions: ScoringDimension[],
): PracticeHistory {
  const completed = sessions.filter(
    (s) => s.status === "completed" && s.score !== null,
  );

  const scores = completed
    .map((s) => s.score!)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  const metrics = computePracticeMetrics(scores, dimensions);

  // Sessions by mode
  const sessionsByMode: Partial<Record<string, number>> = {};
  for (const s of completed) {
    sessionsByMode[s.mode] = (sessionsByMode[s.mode] ?? 0) + 1;
  }

  // Recent scores (last 10)
  const recentScores = scores.slice(-10);

  // Weakest and strongest dimensions
  const dimEntries = Object.entries(metrics.dimensionAverages).map(
    ([key, avg]) => {
      const dim = dimensions.find((d) => d.key === key);
      return { key, label: dim?.label ?? key, averageScore: avg };
    },
  );
  dimEntries.sort((a, b) => a.averageScore - b.averageScore);

  const weakestDimensions = dimEntries.slice(0, 3);
  const strongestDimensions = dimEntries.slice(-3).reverse();

  return {
    totalSessions: completed.length,
    sessionsByMode,
    recentScores,
    improvementTrend: metrics.trend,
    weakestDimensions,
    strongestDimensions,
  };
}
