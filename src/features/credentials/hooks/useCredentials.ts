"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type {
  Credential,
  CredentialMetadata,
  CredentialValues,
  CredentialTemplate,
} from "../lib/types";
import * as credentialService from "../lib/credentialService";

export function useCredentials(client: GatewayClient, status: GatewayStatus) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const result = await credentialService.listCredentials(client);
      setCredentials(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load credentials",
      );
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
  }, [status]);

  const create = useCallback(
    async (
      metadata: Omit<CredentialMetadata, "id" | "createdAt" | "configPaths">,
      values: CredentialValues,
      template: CredentialTemplate,
    ) => {
      try {
        await credentialService.createCredential(
          client,
          metadata,
          values,
          template,
        );
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create credential",
        );
        throw err;
      }
    },
    [client, load],
  );

  const update = useCallback(
    async (
      id: string,
      metadataUpdates?: Partial<Omit<CredentialMetadata, "id">>,
      newValues?: CredentialValues,
    ) => {
      try {
        await credentialService.updateCredential(
          client,
          id,
          metadataUpdates,
          newValues,
        );
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update credential",
        );
        throw err;
      }
    },
    [client, load],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await credentialService.deleteCredential(client, id);
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete credential",
        );
        throw err;
      }
    },
    [client, load],
  );

  const claim = useCallback(
    async (
      configPath: string,
      templateKey?: string,
      template?: CredentialTemplate,
    ) => {
      try {
        await credentialService.claimCredential(
          client,
          configPath,
          templateKey,
          template,
        );
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to claim credential",
        );
        throw err;
      }
    },
    [client, load],
  );

  return {
    credentials,
    loading,
    error,
    refresh: load,
    create,
    update,
    remove,
    claim,
  };
}
