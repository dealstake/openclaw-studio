import { LogOut } from "lucide-react";
import { BRANDING } from "@/lib/branding/config";

type LogoutButtonProps = {
  iconOnly?: boolean;
  className?: string;
};

function handleLogout() {
  // Hit Cloudflare Access logout endpoint first, then show branded logout page
  window.location.href = `${BRANDING.logoutUrl}?returnTo=${encodeURIComponent("/logout")}`;
}

export function LogoutButton({ iconOnly = false, className }: LogoutButtonProps) {
  return (
    <button
      className={`flex items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-destructive transition hover:bg-muted ${className ?? ""}`}
      type="button"
      onClick={handleLogout}
      data-testid="logout-button"
    >
      <LogOut className="h-3.5 w-3.5" />
      {iconOnly ? null : "Sign Out"}
    </button>
  );
}
