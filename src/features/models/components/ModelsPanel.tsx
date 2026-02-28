"use client";

import { memo, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useModels } from "@/features/models/hooks/useModels";
import { SectionLabel } from "@/components/SectionLabel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { PanelIconButton } from "@/components/PanelIconButton";
import { BrainModelSection } from "./BrainModelSection";
import { BrainKeysSection } from "./BrainKeysSection";
import { SpecialistEnginesSection } from "./SpecialistEnginesSection";
import { AdvancedConfigSection } from "./AdvancedConfigSection";
import { ModelCatalogSection } from "./ModelCatalogSection";

interface ModelsPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
  agentId?: string | null;
}

export const ModelsPanel = memo(function ModelsPanel({
  client,
  status,
  agentId,
}: ModelsPanelProps) {
  const {
    brainConfig,
    engines,
    roles,
    providers,
    allModels,
    loading,
    error,
    refresh,
    changeBrainModel,
    saveEngine,
    removeEngine,
    changeRole,
    changeThinking,
    changeCronModel,
  } = useModels(client, status);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-3 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionLabel>Models &amp; Brains</SectionLabel>
        <PanelIconButton
          aria-label="Refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </PanelIconButton>
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Loading */}
      {loading && !brainConfig.primary && (
        <CardSkeleton count={2} variant="card" />
      )}

      {/* Content */}
      {!loading || brainConfig.primary ? (
        <>
          <BrainModelSection
            config={brainConfig}
            providers={providers}
            allModels={allModels}
            onChangePrimary={changeBrainModel}
            disabled={loading}
          />
          <BrainKeysSection agentId={agentId ?? null} />
          <SpecialistEnginesSection
            engines={engines}
            onSaveEngine={saveEngine}
            onRemoveEngine={removeEngine}
          />
          <AdvancedConfigSection
            roles={roles}
            providers={providers}
            onChangeRole={changeRole}
            onChangeThinking={changeThinking}
            onChangeCronModel={changeCronModel}
            disabled={loading}
          />
          <ModelCatalogSection providers={providers} />
        </>
      ) : null}
    </div>
  );
});
