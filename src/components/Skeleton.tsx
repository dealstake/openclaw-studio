export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonAgentRow() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/70 bg-card/65 px-3 py-2">
      <Skeleton className="h-7 w-7 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}

export function SkeletonSessionRow() {
  return (
    <div className="rounded-md border border-border/80 bg-card/70 p-3 space-y-2">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-2.5 w-48" />
    </div>
  );
}

export function SkeletonChatMessage() {
  return (
    <div className="rounded-md border border-border/70 px-3 py-2 space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
