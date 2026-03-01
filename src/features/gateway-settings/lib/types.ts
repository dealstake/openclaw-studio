/**
 * Gateway Settings — TypeScript interfaces.
 *
 * Parsed representations of gateway configuration sections.
 * All types derived from raw config.get snapshot via parseGatewaySettings().
 */

/** Parsed model defaults from agents.defaults */
export type ModelDefaultsConfig = {
  primary: string | null;
  fallbacks: string[];
  /** Key → alias map from agents.defaults.models */
  catalog: Record<string, { alias?: string }>;
};

/** Session reset configuration */
export type SessionResetConfig = {
  mode: "daily" | "idle" | "";
  atHour?: number; // 0-23, for daily mode
  idleMinutes?: number; // for idle mode
  resetByType?: {
    thread?: { mode?: string; atHour?: number; idleMinutes?: number };
    direct?: { mode?: string; atHour?: number; idleMinutes?: number };
    group?: { mode?: string; atHour?: number; idleMinutes?: number };
  };
};

/** Compaction configuration */
export type CompactionConfig = {
  mode: "default" | "safeguard" | "";
  reserveTokensFloor?: number;
  memoryFlush?: { enabled?: boolean };
};

/** Security display (mostly read-only) */
export type SecurityDisplayConfig = {
  authMode: string; // "token" | "none" | "password" | "trusted-proxy"
  hasToken: boolean; // whether a token is configured
  /** Raw token string from config — passed directly to SecureInput (which handles its own masking) */
  tokenRaw: string | null;
  dangerouslyDisableDeviceAuth: boolean; // display only
  trustedProxies: string[]; // display only
};

/** Combined parsed gateway settings */
export type ParsedGatewaySettings = {
  modelDefaults: ModelDefaultsConfig;
  session: SessionResetConfig;
  compaction: CompactionConfig;
  security: SecurityDisplayConfig;
};
