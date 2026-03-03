"use client";

import { GatewayProvider } from "@/lib/gateway/GatewayProvider";
import { AgentStoreProvider } from "@/features/agents/state/store";
import { ExecApprovalProvider } from "@/features/exec-approvals/ExecApprovalProvider";
import { VoiceModeProvider } from "@/features/voice/providers/VoiceModeProvider";
import { VoiceModeOverlay } from "@/features/voice/components/VoiceModeOverlay";
import { VoiceFloatingPill } from "@/features/voice/components/VoiceFloatingPill";
import { AgentStudioPage } from "@/features/studio/AgentStudioContent";

export default function Home() {
  return (
    <GatewayProvider>
      <AgentStoreProvider>
        <ExecApprovalProvider>
          <VoiceModeProvider>
            <AgentStudioPage />
            <VoiceModeOverlay />
            <VoiceFloatingPill />
          </VoiceModeProvider>
        </ExecApprovalProvider>
      </AgentStoreProvider>
    </GatewayProvider>
  );
}
