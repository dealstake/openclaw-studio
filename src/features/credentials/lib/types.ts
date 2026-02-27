/**
 * Credential Vault — Type definitions.
 *
 * Manages skill/integration credentials stored in openclaw.json
 * via config.get / config.patch RPCs.
 */

// ── Enums & Constants ────────────────────────────────────────────────────────

export type CredentialType =
  | "api_key"
  | "api_key_pair"
  | "login"
  | "custom";

export type CredentialStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "missing"
  | "unmanaged";

export type CredentialCategory =
  | "ai"
  | "communication"
  | "productivity"
  | "development"
  | "iot"
  | "custom";

export const CATEGORY_LABELS: Record<CredentialCategory, string> = {
  ai: "AI Services",
  communication: "Communication",
  productivity: "Productivity",
  development: "Development",
  iot: "IoT & Smart Home",
  custom: "Custom",
};

export const CATEGORY_ORDER: CredentialCategory[] = [
  "ai",
  "communication",
  "productivity",
  "development",
  "iot",
  "custom",
];

export const STATUS_DOT_COLORS: Record<CredentialStatus, string> = {
  active: "bg-emerald-500",
  expiring_soon: "bg-amber-500",
  expired: "bg-destructive",
  missing: "bg-amber-500",
  unmanaged: "bg-muted-foreground/30",
};

export const STATUS_LABELS: Record<CredentialStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  missing: "Missing Secret",
  unmanaged: "Unmanaged",
};

// ── Field Definitions ────────────────────────────────────────────────────────

export interface CredentialFieldDef {
  id: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  type?: "text" | "password";
  required?: boolean;
}

// ── Metadata (persisted in studio.credentials[]) ─────────────────────────────

export interface CredentialMetadata {
  id: string;
  humanName: string;
  type: CredentialType;
  serviceName: string;
  templateKey?: string;
  description?: string;
  serviceUrl?: string;
  apiKeyPageUrl?: string;
  category: CredentialCategory;
  expiresAt?: string | null;
  createdAt: string;
  /** openclaw.json paths where this credential's value(s) are written */
  configPaths: string[];
}

// ── Full Credential (metadata + computed fields for UI) ──────────────────────

export interface Credential extends CredentialMetadata {
  status: CredentialStatus;
  hasSecret: boolean;
  maskedPreview?: string;
  pathCount: number;
}

// ── Sensitive values — in memory only during add/edit ────────────────────────

export interface CredentialValues {
  [fieldId: string]: string | undefined;
}

// ── Template for connecting a service ────────────────────────────────────────

export interface CredentialTemplate {
  key: string;
  serviceName: string;
  type: CredentialType;
  category: CredentialCategory;
  serviceUrl: string;
  apiKeyPageUrl: string;
  instructions: string;
  fields: CredentialFieldDef[];
  /** Map of fieldId → openclaw.json config paths to write to */
  configPathMap: Record<string, string[]>;
}
