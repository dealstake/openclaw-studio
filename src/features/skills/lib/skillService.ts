import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { Skill, SkillsReport, SkillSource, SkillEnvRequirement } from "./types";
import { isRecord } from "@/lib/type-guards";

/* ── Constants ── */

const VALID_SOURCES: readonly SkillSource[] = [
  "bundled",
  "managed",
  "workspace",
  "extra",
] as const;

/* ── Parse skills.status response ── */

function parseSkillEntry(key: string, raw: unknown): Skill | null {
  if (!isRecord(raw)) return null;

  const name = typeof raw.name === "string" ? raw.name : key;
  const description =
    typeof raw.description === "string" ? raw.description : "";
  const enabled = raw.enabled !== false;
  const blocked = raw.blocked === true;
  const blockReason =
    typeof raw.blockReason === "string" ? raw.blockReason : undefined;
  const source: SkillSource =
    typeof raw.source === "string" &&
    VALID_SOURCES.includes(raw.source as SkillSource)
      ? (raw.source as SkillSource)
      : "bundled";

  // API key detection
  const hasApiKey = typeof raw.apiKey === "string" && raw.apiKey.length > 0;
  const apiKeyMasked =
    hasApiKey && typeof raw.apiKey === "string"
      ? `••••••${raw.apiKey.slice(-3)}`
      : undefined;

  // Env requirements
  const envRequirements: SkillEnvRequirement[] = [];
  if (isRecord(raw.requires) && isRecord(raw.requires.env)) {
    for (const [envKey, envVal] of Object.entries(raw.requires.env)) {
      envRequirements.push({
        key: envKey,
        description:
          isRecord(envVal) && typeof envVal.description === "string"
            ? envVal.description
            : undefined,
        required: isRecord(envVal) ? envVal.required !== false : true,
        hasValue: isRecord(envVal) ? envVal.hasValue === true : false,
      });
    }
  }

  // Missing deps
  const missingDeps: string[] = Array.isArray(raw.missingDeps)
    ? raw.missingDeps.filter((d): d is string => typeof d === "string")
    : [];

  return {
    key,
    name,
    description,
    source,
    enabled,
    blocked,
    blockReason,
    hasApiKey,
    apiKeyMasked,
    envRequirements,
    missingDeps,
    location:
      typeof raw.location === "string" ? raw.location : undefined,
    packageName:
      typeof raw.packageName === "string" ? raw.packageName : undefined,
  };
}

export function parseSkillsReport(response: unknown): SkillsReport {
  const skills: Skill[] = [];
  const bySource: Record<SkillSource, number> = {
    bundled: 0,
    managed: 0,
    workspace: 0,
    extra: 0,
  };

  if (!isRecord(response)) return { skills, total: 0, bySource };

  // The skills.status response may have skills as an array or as entries keyed by name
  const entries = isRecord(response.entries) ? response.entries : response;

  if (Array.isArray(response.skills)) {
    for (const raw of response.skills) {
      const key =
        isRecord(raw) && typeof raw.key === "string" && raw.key.trim()
          ? raw.key
          : null;
      if (!key) continue; // skip malformed entries
      const skill = parseSkillEntry(key, raw);
      if (skill) {
        skills.push(skill);
        bySource[skill.source]++;
      }
    }
  } else if (isRecord(entries)) {
    for (const [key, raw] of Object.entries(entries)) {
      if (key === "total" || key === "errors") continue;
      const skill = parseSkillEntry(key, raw);
      if (skill) {
        skills.push(skill);
        bySource[skill.source]++;
      }
    }
  }

  // Sort: enabled first, then alphabetical
  skills.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { skills, total: skills.length, bySource };
}

/* ── RPC wrappers ── */

export async function fetchSkillsStatus(
  client: GatewayClient,
): Promise<SkillsReport> {
  const response = await client.call("skills.status", {});
  return parseSkillsReport(response);
}

export async function toggleSkill(
  client: GatewayClient,
  skillKey: string,
  enabled: boolean,
): Promise<void> {
  await client.call("skills.update", { skillKey, enabled });
}

export async function saveSkillApiKey(
  client: GatewayClient,
  skillKey: string,
  apiKey: string,
): Promise<void> {
  await client.call("skills.update", { skillKey, apiKey });
}

export async function installSkill(
  client: GatewayClient,
  name: string,
  installId?: string,
  timeoutMs: number = 120_000,
): Promise<{ message?: string }> {
  const result = await client.call<{ message?: string }>(
    "skills.install",
    { name, installId, timeoutMs },
  );
  return result ?? { message: "Installed" };
}
