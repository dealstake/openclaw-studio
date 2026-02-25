"use client";

import { memo } from "react";

const SKELETON_WIDTHS = ["w-[60px]", "w-[80px]", "w-[100px]"];

export const WorkspaceLoadingSkeleton = memo(function WorkspaceLoadingSkeleton() {
  return (
    <div className="space-y-1 px-1 py-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2">
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className={`h-3 animate-pulse rounded bg-muted ${SKELETON_WIDTHS[i % 3]}`} />
            <div className="h-2 w-16 animate-pulse rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
});
