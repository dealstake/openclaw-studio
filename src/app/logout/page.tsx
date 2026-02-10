"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/login");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size="lg" />
        </div>

        {/* Card */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <h2 className="text-xl font-semibold text-card-foreground">
            You&apos;ve been signed out
          </h2>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to sign in…
          </div>
          <a
            href="/login"
            className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4 transition hover:brightness-110"
          >
            Return to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
