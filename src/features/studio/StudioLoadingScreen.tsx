"use client";

import { memo } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Skeleton } from "@/components/Skeleton";

interface StudioLoadingScreenProps {
  status: "connecting" | "connected";
}

/**
 * Skeleton layout loader that mirrors the actual studio structure.
 *
 * - Desktop: sidebar + chat area + context panel (all skeleton)
 * - Mobile: full-width chat skeleton with bottom nav placeholder
 * - Shows brand mark + status text centered over the skeleton layout
 */
export const StudioLoadingScreen = memo(function StudioLoadingScreen({
  status,
}: StudioLoadingScreenProps) {
  return (
    <div
      className="relative w-screen overflow-hidden bg-background"
      style={{ minHeight: "100svh" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* ── Skeleton layout ────────────────────────────────── */}
      <div className="flex h-svh w-full">
        {/* Sidebar skeleton — hidden on mobile */}
        <div className="hidden md:flex md:w-64 flex-col border-r border-border/10 bg-card/30 p-3 gap-3">
          {/* Brand area */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Agent list skeletons */}
          <div className="flex flex-col gap-2 mt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          {/* Session list skeletons */}
          <div className="mt-auto flex flex-col gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        </div>

        {/* Chat area skeleton */}
        <div className="flex flex-1 flex-col">
          {/* Messages skeleton */}
          <div className="flex-1 flex flex-col gap-5 p-4 pt-12 overflow-hidden">
            {/* Assistant message */}
            <div className="flex flex-col gap-2 max-w-[70%]">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            {/* User message */}
            <div className="flex justify-end">
              <Skeleton className="h-10 w-48 rounded-3xl rounded-br-sm" />
            </div>
            {/* Assistant message */}
            <div className="flex flex-col gap-2 max-w-[70%]">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            {/* User message */}
            <div className="flex justify-end">
              <Skeleton className="h-10 w-32 rounded-3xl rounded-br-sm" />
            </div>
            {/* Assistant message */}
            <div className="flex flex-col gap-2 max-w-[60%]">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          {/* Composer skeleton */}
          <div className="p-4 pb-6 md:pb-4">
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        {/* Context panel skeleton — hidden below lg */}
        <div className="hidden lg:flex lg:w-80 flex-col border-l border-border/10 bg-card/30 p-3 gap-3">
          {/* Tab bar */}
          <div className="flex gap-1.5 px-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-md" />
            ))}
          </div>
          {/* Panel content skeletons */}
          <div className="flex flex-col gap-3 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/10 p-3">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Centered status overlay ───────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-card/95 backdrop-blur-sm rounded-lg px-6 py-6 flex flex-col items-center gap-3 shadow-lg pointer-events-auto">
          <BrandMark size="lg" />
          <div className="text-sm text-muted-foreground">
            {status === "connecting"
              ? "Connecting to gateway…"
              : "Loading agents…"}
          </div>
          <div className="typing-dots mt-1">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav placeholder ─────────────────── */}
      <div className="fixed bottom-0 inset-x-0 md:hidden">
        <div className="flex justify-around border-t border-border/10 bg-background/80 backdrop-blur-sm px-4 py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
});
