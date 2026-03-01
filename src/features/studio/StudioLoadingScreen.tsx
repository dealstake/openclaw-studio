"use client";

import { BrandMark } from "@/components/brand/BrandMark";

interface StudioLoadingScreenProps {
  status: "connecting" | "connected";
}

export const StudioLoadingScreen = ({ status }: StudioLoadingScreenProps) => (
  <div className="relative w-screen overflow-hidden bg-background" style={{ minHeight: "100svh" }}>
    <div className="flex items-center justify-center px-6" style={{ minHeight: "100svh" }}>
      <div className="bg-card rounded-lg w-full max-w-md px-6 py-8 flex flex-col items-center gap-4">
        <BrandMark size="lg" />
        <div className="text-sm text-muted-foreground">
          {status === "connecting" ? "Connecting to gateway…" : "Loading agents…"}
        </div>
        <div className="typing-dots mt-1">
          <span /><span /><span />
        </div>
      </div>
    </div>
  </div>
);
