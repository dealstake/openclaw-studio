"use client";

import { useEffect } from "react";
import { installChunkErrorRecovery } from "@/lib/chunk-error-recovery";

/** Mounts the global chunk error recovery listener. Render once in the root layout. */
export function ChunkErrorRecovery() {
  useEffect(() => installChunkErrorRecovery(), []);
  return null;
}
