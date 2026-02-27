/**
 * Credential Vault — Service layer.
 *
 * All credential CRUD operations via config.get / config.patch.
 * Secrets live at their native config paths; metadata lives in studio.credentials[].
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import { isRecord } from "@/lib/type-guards";
import type {
  Credential,
  CredentialMetadata,
  CredentialValues,
  CredentialTemplate,
  CredentialStatus,
} from "./types";
import { findTemplateByConfigPath } from "./templates";

// ── Skill name → human-friendly name mapping ─────────────────────────────────

const SKILL_FRIENDLY_NAMES: Record<string, { name: string; category: string }> = {
  sag: { name: "ElevenLabs (Voice)", category: "ai" },
  goplaces: { name: "Google Places", category: "productivity" },
  "local-places": { name: "Google Places (Local)", category: "productivity" },
  "nano-banana-pro": { name: "Gemini (Image Gen)", category: "ai" },
  notion: { name: "Notion", category: "productivity" },
  openai: { name: "OpenAI", category: "ai" },
  github: { name: "GitHub", category: "development" },
  himalaya: { name: "Gmail (Himalaya)", category: "communication" },
  twilio: { name: "Twilio", category: "communication" },
  telnyx: { name: "Telnyx", category: "communication" },
  eightctl: { name: "Eight Sleep", category: "iot" },
  openhue: { name: "Philips Hue", category: "iot" },
};

const CONFIG_PATH_FRIENDLY_NAMES: Record<string, { name: string; category: string }> = {
  "tools.web.search.apiKey": { name: "Brave Search", category: "development" },
  "talk.apiKey": { name: "Voice / Talk", category: "ai" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateCredentialId(): string {
  return `cred_${crypto.randomUUID().slice(0, 12)}`;
}

/** Mask a secret: first4 + "••••" + last4 */
export function getMaskedPreview(value: string): string {
  if (typeof value !== "string" || value.length < 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

/** Resolve a dot-path to its value in a nested config object. */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (isRecord(acc) ? acc[key] : undefined),
    obj,
  );
}

/** Build a nested object from a dot-path and value. */
function buildNestedPatch(
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split(".");
  const result: Record<string, unknown> = {};
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {};
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
  return result;
}

/** Deep-merge multiple nested patch objects into one. */
function deepMerge(
  ...objects: Record<string, unknown>[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      if (isRecord(value) && isRecord(result[key])) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          value,
        );
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/** Compute credential status from metadata + config. */
function computeStatus(
  meta: CredentialMetadata,
  config: Record<string, unknown>,
): CredentialStatus {
  const hasSecret = meta.configPaths.some((path) => {
    const val = resolvePath(config, path);
    return typeof val === "string" && val.length > 0;
  });
  if (!hasSecret) return "needs_setup";
  if (meta.expiresAt) {
    const expiry = new Date(meta.expiresAt);
    const now = new Date();
    if (expiry < now) return "expired";
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (expiry.getTime() - now.getTime() < thirtyDays) return "expiring_soon";
  }
  return "connected";
}

/** Known static config paths that hold credentials. */
const KNOWN_CREDENTIAL_PATHS = ["tools.web.search.apiKey", "talk.apiKey"];

/** Extract all credential paths from a config object. */
function findAllSecretPaths(config: Record<string, unknown>): string[] {
  const paths: string[] = [];
  for (const p of KNOWN_CREDENTIAL_PATHS) {
    const val = resolvePath(config, p);
    if (typeof val === "string" && val.length > 0) paths.push(p);
  }
  const skills = isRecord(config.skills) ? config.skills : {};
  const entries = isRecord(skills.entries) ? skills.entries : {};
  for (const [skillName, skillConfig] of Object.entries(entries)) {
    if (!isRecord(skillConfig)) continue;
    if (
      typeof skillConfig.apiKey === "string" &&
      skillConfig.apiKey.length > 0
    ) {
      paths.push(`skills.entries.${skillName}.apiKey`);
    }
    if (isRecord(skillConfig.env)) {
      for (const [envKey, envVal] of Object.entries(skillConfig.env)) {
        if (typeof envVal === "string" && envVal.length > 0) {
          paths.push(`skills.entries.${skillName}.env.${envKey}`);
        }
      }
    }
  }
  return paths;
}

/** Parse metadata list safely from config. */
function readMetadataList(
  config: Record<string, unknown>,
): CredentialMetadata[] {
  const studio = isRecord(config.studio) ? config.studio : {};
  return Array.isArray(studio.credentials)
    ? (studio.credentials as CredentialMetadata[])
    : [];
}

/** Derive a friendly name for an unmanaged config path. */
function deriveFriendlyInfo(configPath: string): {
  name: string;
  category: string;
} {
  // Check direct path mapping first
  const pathInfo = CONFIG_PATH_FRIENDLY_NAMES[configPath];
  if (pathInfo) return pathInfo;

  // Extract skill name from skills.entries.<skillName>.xxx
  const parts = configPath.split(".");
  if (parts[0] === "skills" && parts[1] === "entries" && parts[2]) {
    const skillName = parts[2];
    const skillInfo = SKILL_FRIENDLY_NAMES[skillName];
    if (skillInfo) return skillInfo;
    // Fallback: capitalize the skill name
    return {
      name: skillName.charAt(0).toUpperCase() + skillName.slice(1),
      category: "custom",
    };
  }

  return { name: configPath, category: "custom" };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * List all credentials. Unmanaged secrets are auto-resolved: metadata is
 * created silently by matching against known templates, so nothing ever
 * surfaces as "unmanaged" in the UI.
 */
export async function listCredentials(
  client: GatewayClient,
): Promise<Credential[]> {
  const snapshot = await client.call<GatewayConfigSnapshot>(
    "config.get",
    {},
  );
  const config = isRecord(snapshot.config) ? snapshot.config : {};
  const metadataList = readMetadataList(config);

  const credentials: Credential[] = [];
  const managedPaths = new Set<string>();

  for (const meta of metadataList) {
    try {
      const status = computeStatus(meta, config);
      const firstPath = meta.configPaths[0];
      const firstValue = firstPath
        ? resolvePath(config, firstPath)
        : undefined;
      credentials.push({
        ...meta,
        status,
        hasSecret: status !== "needs_setup",
        maskedPreview:
          typeof firstValue === "string"
            ? getMaskedPreview(firstValue)
            : undefined,
        pathCount: meta.configPaths.length,
      });
      for (const p of meta.configPaths) managedPaths.add(p);
    } catch {
      // Skip malformed entries
    }
  }

  // Auto-resolve unmanaged secrets — create metadata silently
  const allPaths = findAllSecretPaths(config);
  const unmanagedPaths = allPaths.filter((p) => !managedPaths.has(p));

  if (unmanagedPaths.length > 0) {
    const newMetadataEntries: CredentialMetadata[] = [];

    // Group unmanaged paths by template (a template can cover multiple paths)
    const claimedByTemplate = new Set<string>();

    for (const path of unmanagedPaths) {
      if (claimedByTemplate.has(path)) continue;

      const template = findTemplateByConfigPath(path);
      const now = new Date().toISOString();
      const newId = generateCredentialId();

      if (template) {
        // Claim all paths that belong to this template
        const allTemplatePaths = Object.values(template.configPathMap).flat();
        for (const tp of allTemplatePaths) claimedByTemplate.add(tp);

        const newMeta: CredentialMetadata = {
          id: newId,
          humanName: template.serviceName,
          type: template.type,
          serviceName: template.serviceName,
          templateKey: template.key,
          description: template.powersDescription,
          serviceUrl: template.serviceUrl,
          apiKeyPageUrl: template.apiKeyPageUrl,
          category: template.category,
          createdAt: now,
          configPaths: allTemplatePaths,
        };
        newMetadataEntries.push(newMeta);

        const status = computeStatus(newMeta, config);
        const firstValue = resolvePath(config, allTemplatePaths[0]);
        credentials.push({
          ...newMeta,
          status,
          hasSecret: status !== "needs_setup",
          maskedPreview:
            typeof firstValue === "string"
              ? getMaskedPreview(firstValue)
              : undefined,
          pathCount: allTemplatePaths.length,
        });
      } else {
        // No template — use friendly name derivation
        const info = deriveFriendlyInfo(path);
        const newMeta: CredentialMetadata = {
          id: newId,
          humanName: info.name,
          type: "api_key",
          serviceName: info.name,
          category: info.category as CredentialMetadata["category"],
          createdAt: now,
          configPaths: [path],
        };
        newMetadataEntries.push(newMeta);

        const value = resolvePath(config, path);
        credentials.push({
          ...newMeta,
          status: "connected",
          hasSecret: true,
          maskedPreview:
            typeof value === "string" ? getMaskedPreview(value) : undefined,
          pathCount: 1,
        });
      }
    }

    // Batch write all new metadata in a single config.patch (fire and forget)
    if (newMetadataEntries.length > 0) {
      const allExisting = readMetadataList(config);
      const patch = {
        studio: { credentials: [...allExisting, ...newMetadataEntries] },
      };
      client.call("config.patch", { patch }).catch(() => {
        // Silent — auto-resolution is best-effort
      });
    }
  }

  return credentials;
}

/**
 * Read current secret values for a credential (for edit pre-population).
 * Values stay in memory only during the edit session.
 */
export async function readSecretValues(
  client: GatewayClient,
  credential: Credential,
): Promise<CredentialValues> {
  const snapshot = await client.call<GatewayConfigSnapshot>(
    "config.get",
    {},
  );
  const config = isRecord(snapshot.config) ? snapshot.config : {};
  const values: CredentialValues = {};

  // If the credential has a template, map paths back to field IDs
  if (credential.templateKey) {
    const { findTemplate } = await import("./templates");
    const template = findTemplate(credential.templateKey);
    if (template) {
      for (const [fieldId, paths] of Object.entries(template.configPathMap)) {
        for (const path of paths) {
          const val = resolvePath(config, path);
          if (typeof val === "string" && val.length > 0) {
            values[fieldId] = val;
            break; // Use first found value for this field
          }
        }
      }
      return values;
    }
  }

  // Fallback: use first config path as "apiKey" field
  if (credential.configPaths[0]) {
    const val = resolvePath(config, credential.configPaths[0]);
    if (typeof val === "string") {
      values["apiKey"] = val;
    }
  }

  return values;
}

/**
 * Create a new credential — writes metadata + secrets in a single config.patch.
 */
export async function createCredential(
  client: GatewayClient,
  metadata: Omit<CredentialMetadata, "id" | "createdAt" | "configPaths">,
  values: CredentialValues,
  template: CredentialTemplate,
): Promise<Credential> {
  return withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const newId = generateCredentialId();
      const now = new Date().toISOString();
      const configPaths = Object.values(template.configPathMap).flat();

      const newMeta: CredentialMetadata = {
        ...metadata,
        id: newId,
        createdAt: now,
        configPaths,
        templateKey: template.key,
      };

      const existing = readMetadataList(baseConfig);

      let patch: Record<string, unknown> = {
        studio: { credentials: [...existing, newMeta] },
      };

      for (const [fieldId, paths] of Object.entries(template.configPathMap)) {
        const value = values[fieldId];
        if (value) {
          for (const path of paths) {
            patch = deepMerge(patch, buildNestedPatch(path, value));
          }
        }
      }

      const result: Credential = {
        ...newMeta,
        status: "connected",
        hasSecret: true,
        maskedPreview: getMaskedPreview(
          Object.values(values).find(Boolean) ?? "",
        ),
        pathCount: configPaths.length,
      };

      return { shouldPatch: true, patch, result };
    },
  });
}

/**
 * Update an existing credential's metadata and/or secret values.
 */
export async function updateCredential(
  client: GatewayClient,
  id: string,
  metadataUpdates?: Partial<Omit<CredentialMetadata, "id">>,
  newValues?: CredentialValues,
  template?: CredentialTemplate,
): Promise<void> {
  return withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const existing = readMetadataList(baseConfig);

      let target: CredentialMetadata | undefined;
      const updated = existing.map((cred) => {
        if (cred.id === id) {
          target = { ...cred, ...metadataUpdates };
          return target;
        }
        return cred;
      });

      if (!target) throw new Error(`Credential ${id} not found`);

      let patch: Record<string, unknown> = {
        studio: { credentials: updated },
      };

      if (newValues && template) {
        // Use template field→path mapping for precise updates
        for (const [fieldId, paths] of Object.entries(template.configPathMap)) {
          const value = newValues[fieldId];
          if (value) {
            for (const path of paths) {
              patch = deepMerge(patch, buildNestedPatch(path, value));
            }
          }
        }
      } else if (newValues) {
        // Fallback: write to all config paths
        for (const path of target.configPaths) {
          const value = Object.values(newValues).find(Boolean);
          if (value) {
            patch = deepMerge(patch, buildNestedPatch(path, value));
          }
        }
      }

      return { shouldPatch: true, patch, result: undefined };
    },
  });
}

/**
 * Delete a credential — removes metadata and clears secrets.
 */
export async function deleteCredential(
  client: GatewayClient,
  id: string,
): Promise<void> {
  return withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const existing = readMetadataList(baseConfig);

      let pathsToClear: string[] = [];
      const filtered = existing.filter((cred) => {
        if (cred.id === id) {
          pathsToClear = cred.configPaths;
          return false;
        }
        return true;
      });

      if (pathsToClear.length === 0 && existing.length === filtered.length) {
        return { shouldPatch: false, result: undefined };
      }

      let patch: Record<string, unknown> = {
        studio: { credentials: filtered },
      };

      for (const path of pathsToClear) {
        patch = deepMerge(patch, buildNestedPatch(path, ""));
      }

      return { shouldPatch: true, patch, result: undefined };
    },
  });
}

/**
 * Claim an unmanaged credential — creates metadata without writing secrets.
 * Used internally by auto-resolution; not exposed to UI.
 */
export async function claimCredential(
  client: GatewayClient,
  configPath: string,
  templateKey?: string,
  template?: CredentialTemplate,
): Promise<Credential> {
  return withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const newId = generateCredentialId();
      const now = new Date().toISOString();
      const parts = configPath.split(".");
      const skillName = parts[2] ?? configPath;

      const newMeta: CredentialMetadata = {
        id: newId,
        humanName: template?.serviceName ?? skillName,
        type: template?.type ?? "api_key",
        serviceName: template?.serviceName ?? skillName,
        templateKey,
        category: template?.category ?? "custom",
        createdAt: now,
        configPaths: template
          ? Object.values(template.configPathMap).flat()
          : [configPath],
        serviceUrl: template?.serviceUrl,
        apiKeyPageUrl: template?.apiKeyPageUrl,
      };

      const existing = readMetadataList(baseConfig);

      const patch: Record<string, unknown> = {
        studio: { credentials: [...existing, newMeta] },
      };

      const val = resolvePath(baseConfig, configPath);
      const result: Credential = {
        ...newMeta,
        status: "connected",
        hasSecret: true,
        maskedPreview:
          typeof val === "string" ? getMaskedPreview(val) : undefined,
        pathCount: newMeta.configPaths.length,
      };

      return { shouldPatch: true, patch, result };
    },
  });
}
