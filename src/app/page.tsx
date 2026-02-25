"use client";

import { GatewayProvider } from "@/lib/gateway/GatewayProvider";
import { AgentStoreProvider } from "@/features/agents/state/store";
import { ExecApprovalProvider } from "@/features/exec-approvals/ExecApprovalProvider";
import { AgentStudioPage } from "@/features/studio/AgentStudioContent";

export default function Home() {
  return (
    <GatewayProvider>
      <AgentStoreProvider>
        <ExecApprovalProvider>
          <AgentStudioPage />
        </ExecApprovalProvider>
      </AgentStoreProvider>
    </GatewayProvider>
  );
}
