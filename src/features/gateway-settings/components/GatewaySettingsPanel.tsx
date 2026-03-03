"use client";

import { memo, useEffect, useState } from "react";
import { RefreshCw, Settings2 } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { IconButton } from "@/components/IconButton";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { fetchModelsData } from "@/features/models/lib/modelService";
import type { ProviderSummary } from "@/features/models/lib/types";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useGatewaySettings } from "../hooks/useGatewaySettings";
import { ModelDefaultsSection } from "./ModelDefaultsSection";
import { SecuritySection } from "./SecuritySection";
import { SessionDefaultsSection } from "./SessionDefaultsSection";

export interface GatewaySettingsPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
}

export const GatewaySettingsPanel = memo(function GatewaySettingsPanel({
  client,
  status,
}: GatewaySettingsPanelProps) {
  const { settings, loading, error, reload } = useGatewaySettings(client, status);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);

  // Load available providers for ModelPicker (once per connection)
  useEffect(() => {
    if (status !== "connected") return;
    void fetchModelsData(client).then((data) => {
      setProviders(data.providers);
    });
  }, [client, status]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        icon={<Settings2 className="h-4 w-4" />}
        title="Gateway"
        actions={
          <IconButton
            aria-label="Refresh gateway settings"
            onClick={() => void reload()}
            disabled={loading || status !== "connected"}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </IconButton>
        }
      />

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {status !== "connected" && (
          <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-center">
            <p className="text-[11px] text-muted-foreground">
              Gateway disconnected — settings unavailable
            </p>
          </div>
        )}

        {status === "connected" && loading && !settings && (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => void reload()}
            className="mb-3"
          />
        )}

        {settings && (
          <div className="space-y-4">
            <ModelDefaultsSection
              config={settings}
              client={client}
              providers={providers}
              onSaved={reload}
            />
            <SessionDefaultsSection
              config={settings}
              client={client}
              onSaved={reload}
            />
            <SecuritySection config={settings} client={client} />
          </div>
        )}
      </div>
    </div>
  );
});
