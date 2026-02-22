import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  extractJsonErrorMessage,
  parseJsonOutput,
  runSshJson,
} from "@/lib/ssh/gateway-host";

export const BEADS_WORKSPACE_NOT_INITIALIZED_ERROR_MESSAGE =
  "Beads workspace not initialized for this project. Run: br init --prefix <scope>.";

export const coerceBrSingleRecord = (
  value: unknown,
  opts: { command: "show" | "update"; id: string }
): Record<string, unknown> => {
  const record = Array.isArray(value) ? value[0] : value;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Unexpected br ${opts.command} --json output for ${opts.id}.`);
  }
  return record as Record<string, unknown>;
};

type RunBrJsonOptions = {
  cwd?: string;
  env?: Record<string, string>;
};

const runBrJsonLocal = async (command: string[], options?: RunBrJsonOptions): Promise<unknown> => {
  const args = [...command, "--json"];
  const { stdout, stderr, exitCode } = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
    (resolve, reject) => {
      childProcess.execFile(
        "br",
        args,
        {
          cwd: options?.cwd,
          env: { ...process.env, ...(options?.env ?? {}) },
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error && !("code" in error && typeof error.code === "number")) {
            reject(new Error(`Failed to execute br: ${error.message}`));
            return;
          }
          const code = error && "code" in error && typeof error.code === "number" ? error.code : 0;
          resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode: code });
        },
      );
    },
  );
  const stderrText = stderr.trim();
  const stdoutText = stdout.trim();
  if (exitCode !== 0) {
    const message =
      extractJsonErrorMessage(stdout) ??
      extractJsonErrorMessage(stderr) ??
      (stderrText || stdoutText || `Command failed: br ${args.join(" ")}`);
    throw new Error(message);
  }
  return parseJsonOutput(stdout, `br ${command.join(" ")} --json`);
};

const quoteShellArg = (value: string) => "'" + value.replaceAll("'", "'\"'\"'") + "'";

const runBrJsonViaSsh = async (command: string[], options: { sshTarget: string; cwd: string }): Promise<unknown> => {
  const remote =
    `cd ${quoteShellArg(options.cwd)} && ` +
    `PATH=\"$HOME/.local/bin:$HOME/.cargo/bin:$PATH\" ` +
    `br ${command.join(" ")} --json`;
  return runSshJson({
    sshTarget: options.sshTarget,
    argv: [remote],
    label: `br ${command.join(" ")} --json`,
    fallbackMessage: `Command failed: ssh ${options.sshTarget} <br>`,
  });
};

const parseScopePath = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const path = (value as Record<string, unknown>).path;
  return typeof path === "string" && path.trim().length > 0 ? path : null;
};

const BEADS_DIR_ENV = "OPENCLAW_TASK_CONTROL_PLANE_BEADS_DIR";
const GATEWAY_BEADS_DIR_ENV = "OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR";

const resolveTaskControlPlaneCwd = (): string | undefined => {
  const configured = process.env[BEADS_DIR_ENV];
  if (!configured) return undefined;
  const trimmed = configured.trim();
  if (!trimmed) return undefined;

  if (path.basename(trimmed) !== ".beads") {
    throw new Error(
      `${BEADS_DIR_ENV} must be an absolute path to a ".beads" directory (got: ${trimmed}).`
    );
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(trimmed);
  } catch {
    throw new Error(`${BEADS_DIR_ENV} does not exist on this host: ${trimmed}.`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`${BEADS_DIR_ENV} must point to a directory (got file): ${trimmed}.`);
  }

  return path.dirname(trimmed);
};

const resolveGatewayBeadsDir = (): string | undefined => {
  const configured = process.env[GATEWAY_BEADS_DIR_ENV];
  if (!configured) return undefined;
  const trimmed = configured.trim();
  if (!trimmed) return undefined;

  if (!path.isAbsolute(trimmed) || path.basename(trimmed) !== ".beads") {
    throw new Error(
      `${GATEWAY_BEADS_DIR_ENV} must be an absolute path to a ".beads" directory on the gateway host (got: ${trimmed}).`
    );
  }

  return trimmed;
};

export const isBeadsWorkspaceError = (message: string) => {
  const lowered = message.toLowerCase();
  return lowered.includes("no beads directory found") || lowered.includes("not initialized");
};

export const createTaskControlPlaneBrRunner = (opts?: {
  sshTarget?: string | null;
}): {
  runBrJson: (command: string[]) => Promise<unknown>;
  parseScopePath: (value: unknown) => string | null;
} => {
  const gatewayBeadsDir = resolveGatewayBeadsDir();
  if (gatewayBeadsDir) {
    const sshTarget = opts?.sshTarget?.trim() ?? "";
    if (!sshTarget) {
      throw new Error(
        "SSH target is required when OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR is set."
      );
    }
    const cwd = path.dirname(gatewayBeadsDir);
    return {
      runBrJson: (command) => runBrJsonViaSsh(command, { sshTarget, cwd }),
      parseScopePath,
    };
  }
  const cwd = resolveTaskControlPlaneCwd();
  return {
    runBrJson: (command) => runBrJsonLocal(command, { cwd }),
    parseScopePath,
  };
};
