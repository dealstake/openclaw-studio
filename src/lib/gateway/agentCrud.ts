import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { ConfigAgentEntry } from "@/lib/gateway/agentConfigTypes";
import { upsertConfigAgentEntry } from "@/lib/gateway/agentConfigTypes";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";

const slugifyName = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error("Name produced an empty folder name.");
  }
  return slug;
};

const createUniqueAgentId = (name: string, list: ConfigAgentEntry[]) => {
  const base = slugifyName(name);
  const existing = new Set(list.map((entry) => entry.id));
  if (!existing.has(base)) return base;
  for (let suffix = 2; suffix < 100000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error("Unable to allocate a unique agent ID.");
};

export const renameGatewayAgent = async (params: {
  client: GatewayClient;
  agentId: string;
  name: string;
  sessionKey?: string;
}) => {
  const trimmed = params.name.trim();
  if (!trimmed) {
    throw new Error("Agent name is required.");
  }
  return withGatewayConfigMutation({
    client: params.client,
    sessionKey: params.sessionKey,
    mutate: ({ list }) => {
      const { list: nextList, entry } = upsertConfigAgentEntry(
        list,
        params.agentId,
        (entry: ConfigAgentEntry) => ({
          ...entry,
          name: trimmed,
        })
      );
      return {
        shouldPatch: true,
        patch: { agents: { list: nextList } },
        result: entry,
      };
    },
  });
};

export const createGatewayAgent = async (params: {
  client: GatewayClient;
  name: string;
  sessionKey?: string;
}): Promise<ConfigAgentEntry> => {
  const trimmed = params.name.trim();
  if (!trimmed) {
    throw new Error("Agent name is required.");
  }
  return withGatewayConfigMutation({
    client: params.client,
    sessionKey: params.sessionKey,
    mutate: ({ list }) => {
      const id = createUniqueAgentId(trimmed, list);
      const entry: ConfigAgentEntry = { id, name: trimmed };
      const nextList = [...list, entry];
      return {
        shouldPatch: true,
        patch: { agents: { list: nextList } },
        result: entry,
      };
    },
  });
};

export const deleteGatewayAgent = async (params: {
  client: GatewayClient;
  agentId: string;
  sessionKey?: string;
}) => {
  return withGatewayConfigMutation({
    client: params.client,
    sessionKey: params.sessionKey,
    mutate: ({ baseConfig, list }) => {
      const nextList = list.filter((entry) => entry.id !== params.agentId);
      const bindings = Array.isArray(baseConfig.bindings) ? baseConfig.bindings : [];
      const nextBindings = bindings.filter((binding) => {
        if (!binding || typeof binding !== "object") return true;
        const agentId = (binding as Record<string, unknown>).agentId;
        return agentId !== params.agentId;
      });
      const patch: Record<string, unknown> = {};
      if (nextList.length !== list.length) {
        patch.agents = { list: nextList };
      }
      if (nextBindings.length !== bindings.length) {
        patch.bindings = nextBindings;
      }
      const shouldPatch = Object.keys(patch).length > 0;
      if (!shouldPatch) {
        return {
          shouldPatch: false,
          result: {
            removed: false,
            removedBindings: 0,
          },
        };
      }
      return {
        shouldPatch: true,
        patch,
        result: {
          removed: nextList.length !== list.length,
          removedBindings: bindings.length - nextBindings.length,
        },
      };
    },
  });
};
