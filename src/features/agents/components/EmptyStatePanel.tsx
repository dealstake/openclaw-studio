import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/SectionLabel";
import { TridentLogo } from "@/components/brand/TridentLogo";

type EmptyStatePanelProps = {
  title: string;
  label?: string;
  description?: string;
  detail?: string;
  fillHeight?: boolean;
  compact?: boolean;
  branded?: boolean;
  className?: string;
};

export const EmptyStatePanel = ({
  title,
  label,
  description,
  detail,
  fillHeight = false,
  compact = false,
  branded = false,
  className,
}: EmptyStatePanelProps) => {
  return (
    <div
      className={cn(
        "animate-in fade-in zoom-in-[0.98] duration-300 rounded-md border border-border/80 bg-card/70 text-muted-foreground",
        fillHeight ? "flex h-full w-full flex-col justify-center" : "",
        branded ? "items-center text-center" : "",
        className
      )}
    >
      {branded ? (
        <TridentLogo size={32} className="mb-3 text-brand-gold/50" />
      ) : null}
      {label ? (
        <SectionLabel as="p">
          {label}
        </SectionLabel>
      ) : null}
      <p
        className={cn(
          "console-title mt-2 text-2xl leading-none text-foreground sm:text-3xl",
          compact ? "mt-0 text-xs font-medium tracking-normal text-muted-foreground sm:text-xs" : ""
        )}
      >
        {title}
      </p>
      {description ? (
        <p className={cn("mt-3 text-sm text-muted-foreground", compact ? "mt-1 text-xs" : "")}>
          {description}
        </p>
      ) : null}
      {detail ? (
        <p className="mt-3 rounded-md border border-border/80 bg-background/75 px-4 py-2 font-sans text-xs text-muted-foreground/90">
          {detail}
        </p>
      ) : null}
    </div>
  );
};
