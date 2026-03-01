"use client";

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Lightbulb,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeScore, ScoringDimension } from "../lib/personaTypes";

// ---------------------------------------------------------------------------
// Score ring (radial progress)
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score / 10;
  const offset = circumference * (1 - pct);
  const color =
    score >= 8
      ? "text-emerald-500"
      : score >= 5
        ? "text-amber-500"
        : "text-red-400";

  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Overall score: ${score.toFixed(1)} out of 10`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-border/30"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className={cn("transition-all duration-700", color)}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-lg font-bold", color)}>
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension bar
// ---------------------------------------------------------------------------

function DimensionBar({
  dimension,
  score,
}: {
  dimension: ScoringDimension;
  score: number;
}) {
  const pct = (score / 10) * 100;
  const color =
    score >= 8
      ? "bg-emerald-500"
      : score >= 5
        ? "bg-amber-500"
        : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
        {dimension.label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-border/20">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-xs font-medium text-foreground">
        {score}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PracticeScoreCard
// ---------------------------------------------------------------------------

export interface PracticeScoreCardProps {
  score: PracticeScore;
  dimensions: ScoringDimension[];
  previousScore?: PracticeScore | null;
}

export const PracticeScoreCard = React.memo(function PracticeScoreCard({
  score,
  dimensions,
  previousScore,
}: PracticeScoreCardProps) {
  const diff = previousScore ? score.overall - previousScore.overall : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/40 bg-card p-4">
      {/* Header: overall score */}
      <div className="flex items-center gap-4">
        <ScoreRing score={score.overall} />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Overall Score
            </span>
          </div>
          {diff !== null && diff !== 0 && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs",
                diff > 0 ? "text-emerald-500" : "text-red-400",
              )}
            >
              {diff > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {diff > 0 ? "+" : ""}
              {diff.toFixed(1)} from last session
            </div>
          )}
        </div>
      </div>

      {/* Dimension breakdown */}
      {dimensions.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Dimension Scores
            </span>
          </div>
          {dimensions.map((dim) => (
            <DimensionBar
              key={dim.key}
              dimension={dim}
              score={score.dimensions[dim.key] ?? 0}
            />
          ))}
        </div>
      )}

      {/* Feedback */}
      <div className="rounded-lg border border-border/20 bg-muted/30 p-3">
        <p className="text-sm text-foreground leading-relaxed">
          {score.feedback}
        </p>
      </div>

      {/* Improvement suggestions */}
      {score.improvements.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Areas to Improve
            </span>
          </div>
          <ul className="flex flex-col gap-1.5 pl-5">
            {score.improvements.map((item, i) => (
              <li
                key={i}
                className="list-disc text-xs text-muted-foreground leading-relaxed"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
