import { memo } from "react";
import { cn } from "@/lib/utils";

type CardSkeletonVariant = "card" | "compact" | "list";

type CardSkeletonProps = {
  count?: number;
  variant?: CardSkeletonVariant;
  className?: string;
};

const pulseBar = "animate-pulse rounded-md bg-muted/60";

function SkeletonCard({ variant }: { variant: CardSkeletonVariant }) {
  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className={cn(pulseBar, "h-3 w-1/2")} />
        <div className={cn(pulseBar, "h-2.5 w-[30%]")} />
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="flex items-center gap-3 px-3 py-2">
        <div className={cn(pulseBar, "h-8 w-8 shrink-0 rounded-full")} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className={cn(pulseBar, "h-3 w-3/5")} />
          <div className={cn(pulseBar, "h-2.5 w-2/5")} />
        </div>
      </div>
    );
  }

  // card variant (default)
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4">
      <div className="flex flex-col gap-2.5">
        <div className={cn(pulseBar, "h-3.5 w-[60%]")} />
        <div className={cn(pulseBar, "h-3 w-[80%]")} />
        <div className={cn(pulseBar, "h-2.5 w-[40%] mt-1")} />
      </div>
    </div>
  );
}

export const CardSkeleton = memo(function CardSkeleton({
  count = 3,
  variant = "card",
  className,
}: CardSkeletonProps) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-in fade-in duration-300"
          style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
        >
          <SkeletonCard variant={variant} />
        </div>
      ))}
    </div>
  );
});
