import { LogOut } from "lucide-react";
import { logout } from "@/lib/cloudflare-auth";

type LogoutButtonProps = {
  iconOnly?: boolean;
  className?: string;
};

export function LogoutButton({ iconOnly = false, className }: LogoutButtonProps) {
  return (
    <button
      className={`flex items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-destructive transition hover:bg-muted ${className ?? ""}`}
      type="button"
      onClick={logout}
      data-testid="logout-button"
    >
      <LogOut className="h-3.5 w-3.5" />
      {iconOnly ? null : "Sign Out"}
    </button>
  );
}
