/**
 * Lightweight server-side gateway RPC client.
 *
 * Uses Node.js native WebSocket (Node ≥21) to call gateway methods
 * from Next.js API routes. Opens a short-lived connection per call,
 * suitable for infrequent server-side aggregation queries.
 */

import { randomUUID } from "node:crypto";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "ws://127.0.0.1:18789";
const GATEWAY_TOKEN =
  process.env.GATEWAY_TOKEN ?? process.env.NEXT_PUBLIC_GATEWAY_TOKEN ?? "";

const CONNECT_TIMEOUT_MS = 5_000;
const RPC_TIMEOUT_MS = 30_000;

type GatewayRpcError = {
  code?: string;
  message?: string;
};

/**
 * Open a WebSocket to the gateway, authenticate, call a method, and close.
 *
 * @throws Error on timeout, auth failure, or RPC error
 */
export async function gatewayRpc<T = unknown>(
  method: string,
  params: unknown,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const ws = new WebSocket(GATEWAY_URL);

    const connectTimer = setTimeout(() => {
      settle(() => {
        ws.close();
        reject(new Error("Gateway connect timeout"));
      });
    }, CONNECT_TIMEOUT_MS);

    const rpcTimer = setTimeout(() => {
      settle(() => {
        ws.close();
        reject(new Error("Gateway RPC timeout"));
      });
    }, RPC_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(connectTimer);
      clearTimeout(rpcTimer);
    };

    const connectId = randomUUID();
    const rpcId = randomUUID();

    ws.addEventListener("open", () => {
      // Send connect/hello frame with token auth
      const connectFrame = {
        type: "req",
        id: connectId,
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "openclaw-studio-server",
            version: "1.0.0",
            platform: "nodejs",
            mode: "api",
          },
          role: "admin",
          scopes: ["*"],
          auth: GATEWAY_TOKEN ? { token: GATEWAY_TOKEN } : undefined,
          caps: [],
        },
      };
      ws.send(JSON.stringify(connectFrame));
    });

    ws.addEventListener("message", (event) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      // Handle connect response
      if (parsed.id === connectId) {
        clearTimeout(connectTimer);
        if (!parsed.ok) {
          const err = parsed.error as GatewayRpcError | undefined;
          settle(() => {
            cleanup();
            ws.close();
            reject(
              new Error(
                `Gateway auth failed: ${err?.message ?? "unknown error"}`,
              ),
            );
          });
          return;
        }
        // Auth succeeded — send the actual RPC
        const rpcFrame = { type: "req", id: rpcId, method, params };
        ws.send(JSON.stringify(rpcFrame));
        return;
      }

      // Handle RPC response
      if (parsed.id === rpcId) {
        settle(() => {
          cleanup();
          ws.close();
          if (parsed.ok) {
            resolve(parsed.payload as T);
          } else {
            const err = parsed.error as GatewayRpcError | undefined;
            reject(
              new Error(
                `Gateway RPC error: ${err?.message ?? "unknown error"}`,
              ),
            );
          }
        });
      }
    });

    ws.addEventListener("error", () => {
      settle(() => {
        cleanup();
        reject(new Error("Gateway WebSocket error"));
      });
    });

    ws.addEventListener("close", () => {
      settle(() => {
        cleanup();
        reject(new Error("Gateway connection closed unexpectedly"));
      });
    });
  });
}
