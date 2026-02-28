/**
 * Models & Brains — Service layer.
 *
 * All reads use models.list + config.get + cron.list RPCs.
 * All writes use config.patch via withGatewayConfigMutation.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import { isRecord, parseString, parseStringList } from "@/lib/type-guards";
import { findEngineTemplate, maskApiKey } from "./engineRegistry";
import type {
  BrainModelConfig,
  CronModelOverride,
  EngineType,
  ModelInfo,
  ModelRoles,
  ModelsData,
  ProviderSummary,
  SpecialistEngine,
} from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Human-readable model name from provider/id */
function humanizeModelId(id: string): string {
  const versionRe = /^(\d+)-(\d+)$/;
  return id
    .split("-")
    .reduce<string[]>((acc, segment, i, arr) => {
      if (i > 0) {
        const combined = `${arr[i - 1]}-${segment}`;
        if (versionRe.test(combined)) {
          acc[acc.length - 1] = combined.replace(versionRe, "$1.$2");
          return acc;
        }
      }
      acc.push(segment.charAt(0).toUpperCase() + segment.slice(1));
      return acc;
    }, [])
    .join(" ");
}

function resolveModelName(
  fullKey: string | null,
  catalog: GatewayModelChoice[],
): string {
  if (!fullKey) return "Not set";
  const entry = catalog.find((m) => `${m.provider}/${m.id}` === fullKey);
  if (entry) return entry.name || humanizeModelId(entry.id);
  const parts = fullKey.split("/");
  return humanizeModelId(parts[parts.length - 1] ?? fullKey);
}

// ── Config Parsing ───────────────────────────────────────────────────────────

function parseBrainConfig(
  config: Record<string, unknown>,
  catalog: GatewayModelChoice[],
): BrainModelConfig {
  const agents = isRecord(config.agents) ? config.agents : {};
  const defaults = isRecord(agents.defaults) ? agents.defaults : {};
  const modelCfg = defaults.model;

  let primary: string | null = null;
  let fallbacks: string[] = [];

  if (typeof modelCfg === "string") {
    primary = modelCfg;
  } else if (isRecord(modelCfg)) {
    primary = parseString(modelCfg.primary);
    fallbacks = parseStringList(modelCfg.fallbacks);
  }

  return {
    primary,
    primaryName: resolveModelName(primary, catalog),
    fallbacks,
    fallbackNames: fallbacks.map((f) => resolveModelName(f, catalog)),
  };
}

function parseSpecialistEngines(
  config: Record<string, unknown>,
): SpecialistEngine[] {
  const skills = isRecord(config.skills) ? config.skills : {};
  const entries = isRecord(skills.entries) ? skills.entries : {};
  const env = isRecord(config.env) ? config.env : {};
  const envVars = isRecord(env.vars) ? env.vars : {};

  return Object.entries(entries)
    .filter(([key]) => key.startsWith("pipeline:"))
    .map(([key, value]) => {
      const entry = isRecord(value) ? value : {};
      const type = key.replace("pipeline:", "") as EngineType;
      const template = findEngineTemplate(type);
      const envKey = template?.primaryEnvKey ?? `${type.toUpperCase()}_API_KEY`;
      const apiKey = parseString(envVars[envKey]);
      const modelKey = `${type.toUpperCase()}_PIPELINE_MODEL`;
      const fallbackKey = `${type.toUpperCase()}_PIPELINE_FALLBACK`;

      return {
        type,
        configKey: key,
        displayName: template?.displayName ?? type,
        enabled: entry.enabled !== false,
        hasApiKey: !!apiKey,
        maskedApiKey: maskApiKey(apiKey),
        model:
          parseString(envVars[modelKey]) ??
          template?.defaultModel ??
          "",
        fallbackModel: parseString(envVars[fallbackKey]),
        purpose:
          template?.bestFor ??
          (typeof entry.description === "string"
            ? entry.description
            : ""),
      };
    });
}

function parseModelRoles(
  config: Record<string, unknown>,
  catalog: GatewayModelChoice[],
  cronJobs: CronJobEntry[],
): ModelRoles {
  const agents = isRecord(config.agents) ? config.agents : {};
  const defaults = isRecord(agents.defaults) ? agents.defaults : {};
  const subagents = isRecord(defaults.subagents) ? defaults.subagents : {};
  const heartbeat = isRecord(defaults.heartbeat) ? defaults.heartbeat : {};

  const subagentModel = parseString(subagents.model);
  const heartbeatModel = parseString(heartbeat.model);

  const cronOverrides: CronModelOverride[] = cronJobs.map((job) => ({
    cronId: job.id,
    cronName: job.name ?? job.id,
    model: job.model ?? null,
    modelName: resolveModelName(job.model ?? null, catalog),
  }));

  return {
    subagentModel,
    subagentModelName: resolveModelName(subagentModel, catalog),
    subagentThinking: parseString(subagents.thinking),
    heartbeatModel,
    heartbeatModelName: resolveModelName(heartbeatModel, catalog),
    cronOverrides,
  };
}

function buildModelCatalog(
  catalog: GatewayModelChoice[],
  brainConfig: BrainModelConfig,
): { allModels: ModelInfo[]; providers: ProviderSummary[] } {
  const allModels: ModelInfo[] = catalog.map((m) => {
    const fullKey = `${m.provider}/${m.id}`;
    return {
      id: m.id,
      name: m.name || humanizeModelId(m.id),
      provider: m.provider,
      fullKey,
      contextWindow: m.contextWindow,
      reasoning: m.reasoning,
      isConfigured: true,
      isDefault: fullKey === brainConfig.primary,
      isFallback: brainConfig.fallbacks.includes(fullKey),
    };
  });

  // Group by provider
  const providerMap = new Map<string, ModelInfo[]>();
  for (const model of allModels) {
    const list = providerMap.get(model.provider) ?? [];
    list.push(model);
    providerMap.set(model.provider, list);
  }

  const PROVIDER_DISPLAY: Record<string, string> = {
    anthropic: "Anthropic",
    google: "Google",
    openai: "OpenAI",
    mistral: "Mistral",
  };

  const providers: ProviderSummary[] = Array.from(providerMap.entries()).map(
    ([name, models]) => ({
      name,
      displayName: PROVIDER_DISPLAY[name] ?? name,
      modelCount: models.length,
      configuredCount: models.filter((m) => m.isConfigured).length,
      models,
    }),
  );

  return { allModels, providers };
}

// ── Cron Job Types (minimal) ─────────────────────────────────────────────────

type CronJobEntry = {
  id: string;
  name?: string;
  model?: string;
};

type CronListResult = {
  jobs?: CronJobEntry[];
};

type ModelsListResult = GatewayModelChoice[];

// ── Public API ───────────────────────────────────────────────────────────────

/** Fetch all model data in parallel: brain config, engines, catalog, roles */
export async function fetchModelsData(
  client: GatewayClient,
): Promise<ModelsData> {
  const [catalogResult, configSnapshot, cronResult] = await Promise.all([
    client.call<ModelsListResult>("models.list", {}),
    client.call<GatewayConfigSnapshot>("config.get", {}),
    client.call<CronListResult>("cron.list", {}),
  ]);

  const catalog = Array.isArray(catalogResult) ? catalogResult : [];
  const config = isRecord(configSnapshot.config) ? configSnapshot.config : {};
  const cronJobs = Array.isArray(cronResult.jobs) ? cronResult.jobs : [];

  const brainConfig = parseBrainConfig(config, catalog);
  const engines = parseSpecialistEngines(config);
  const roles = parseModelRoles(config, catalog, cronJobs);
  const { allModels, providers } = buildModelCatalog(catalog, brainConfig);

  return { brainConfig, engines, roles, providers, allModels };
}

// ── Write Operations (all via config.patch) ──────────────────────────────────

/** Change primary brain model */
export async function setBrainModel(
  client: GatewayClient,
  modelKey: string,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const agents = isRecord(baseConfig.agents) ? baseConfig.agents : {};
      const defaults = isRecord(agents.defaults) ? agents.defaults : {};
      const modelCfg = isRecord(defaults.model) ? defaults.model : {};
      return {
        shouldPatch: true,
        patch: {
          agents: {
            defaults: {
              model: { ...modelCfg, primary: modelKey },
            },
          },
        },
        result: undefined,
      };
    },
  });
}

/** Update fallback models for brain */
export async function setBrainFallbacks(
  client: GatewayClient,
  fallbacks: string[],
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const agents = isRecord(baseConfig.agents) ? baseConfig.agents : {};
      const defaults = isRecord(agents.defaults) ? agents.defaults : {};
      const modelCfg = isRecord(defaults.model) ? defaults.model : {};
      return {
        shouldPatch: true,
        patch: {
          agents: {
            defaults: {
              model: { ...modelCfg, fallbacks },
            },
          },
        },
        result: undefined,
      };
    },
  });
}

/** Add or update a specialist engine (writes to env.vars + skills.entries) */
export async function saveSpecialistEngine(
  client: GatewayClient,
  type: EngineType,
  apiKey: string,
  model: string,
  fallbackModel: string | null,
): Promise<void> {
  const template = findEngineTemplate(type);
  const envKey = template?.primaryEnvKey ?? `${type.toUpperCase()}_API_KEY`;
  await withGatewayConfigMutation({
    client,
    mutate: () => ({
      shouldPatch: true,
      patch: {
        env: {
          vars: {
            [envKey]: apiKey,
            [`${type.toUpperCase()}_PIPELINE_MODEL`]: model,
            ...(fallbackModel
              ? { [`${type.toUpperCase()}_PIPELINE_FALLBACK`]: fallbackModel }
              : {}),
          },
        },
        skills: {
          entries: {
            [`pipeline:${type}`]: {
              enabled: true,
              description: template?.bestFor ?? "",
            },
          },
        },
      },
      result: undefined,
    }),
  });
}

/** Change a model role (sub-agent or heartbeat) */
export async function setModelRole(
  client: GatewayClient,
  role: "subagent" | "heartbeat",
  modelKey: string,
): Promise<void> {
  const path =
    role === "subagent"
      ? { agents: { defaults: { subagents: { model: modelKey } } } }
      : { agents: { defaults: { heartbeat: { model: modelKey } } } };
  await withGatewayConfigMutation({
    client,
    mutate: () => ({ shouldPatch: true, patch: path, result: undefined }),
  });
}

/** Change sub-agent thinking level */
export async function setThinkingLevel(
  client: GatewayClient,
  thinking: string,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: () => ({
      shouldPatch: true,
      patch: { agents: { defaults: { subagents: { thinking } } } },
      result: undefined,
    }),
  });
}

/** Change a cron job's model override */
export async function setCronModel(
  client: GatewayClient,
  cronId: string,
  modelKey: string | null,
): Promise<void> {
  await client.call("cron.edit", {
    id: cronId,
    model: modelKey ?? undefined,
  });
}

/** Remove a specialist engine (clears env vars + disables metadata) */
export async function removeSpecialistEngine(
  client: GatewayClient,
  type: EngineType,
): Promise<void> {
  const template = findEngineTemplate(type);
  const envKey = template?.primaryEnvKey ?? `${type.toUpperCase()}_API_KEY`;
  await withGatewayConfigMutation({
    client,
    mutate: () => ({
      shouldPatch: true,
      patch: {
        env: {
          vars: {
            [envKey]: null,
            [`${type.toUpperCase()}_PIPELINE_MODEL`]: null,
            [`${type.toUpperCase()}_PIPELINE_FALLBACK`]: null,
          },
        },
        skills: {
          entries: {
            [`pipeline:${type}`]: { enabled: false },
          },
        },
      },
      result: undefined,
    }),
  });
}
