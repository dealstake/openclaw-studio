"use client";

import { useState } from "react";
import type { AgentFileName } from "@/lib/agents/agentFiles";

/**
 * Manages brain panel state: active file tab and preview mode.
 * Extracted from useAppLayout for focused re-render boundaries.
 */
export function useBrainPanelState() {
  const [brainFileTab, setBrainFileTab] = useState<AgentFileName>("AGENTS.md");
  const [brainPreviewMode, setBrainPreviewMode] = useState(true);

  return {
    brainFileTab,
    setBrainFileTab,
    brainPreviewMode,
    setBrainPreviewMode,
  } as const;
}
