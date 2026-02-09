import type { CfIdentity } from "@/lib/cloudflare-auth";

type UserBadgeProps = {
  identity: CfIdentity | null;
  className?: string;
};

export function UserBadge({ identity, className }: UserBadgeProps) {
  if (!identity?.email) return null;
  const initial = identity.email[0]?.toUpperCase() ?? "?";
  return (
    <span className={`hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex ${className ?? ""}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
        {initial}
      </span>
      {identity.email}
    </span>
  );
}
