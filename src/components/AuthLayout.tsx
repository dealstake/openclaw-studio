import { BrandMark } from "@/components/brand/BrandMark";

/**
 * Shared layout wrapper for auth pages (login, logout).
 * Provides the centered brand + card pattern.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 sm:space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" />
        </div>

        {children}
      </div>
    </div>
  );
}
