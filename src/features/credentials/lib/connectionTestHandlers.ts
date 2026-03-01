/**
 * Connection test handlers — shared between API route and preflight service.
 *
 * Each handler receives credential key-value pairs and validates them
 * against the target service. Handlers run server-side only.
 *
 * Phase 3 of Persona Preflight Engine: extracted from /api/integrations/test
 * so preflightService can call handlers directly (no HTTP round-trip).
 */

import type { ConnectionTestResult } from "./types";

export type TestHandler = (
  creds: Record<string, string>,
) => Promise<ConnectionTestResult>;

/** Abort-safe fetch with timeout (default 10s). */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const gmail: TestHandler = async (creds) => {
  const email = creds.username;
  const password = creds.password;
  if (!email?.includes("@")) {
    return { success: false, message: "Invalid email address" };
  }
  if (!password || password.replace(/\s/g, "").length < 16) {
    return {
      success: false,
      message: "App password should be 16 characters (spaces removed)",
    };
  }
  return {
    success: true,
    message: "Credentials format validated. Gmail will be tested on first use.",
  };
};

const elevenlabs: TestHandler = async (creds) => {
  const key = creds.apiKey;
  if (!key) return { success: false, message: "API key is required" };
  try {
    const res = await fetchWithTimeout(
      "https://api.elevenlabs.io/v1/voices",
      { headers: { "xi-api-key": key } },
    );
    if (res.ok) {
      return { success: true, message: "Connected! Found your ElevenLabs voices." };
    }
    if (res.status === 401) {
      return { success: false, message: "Invalid API key." };
    }
    return { success: false, message: `ElevenLabs returned ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, message: "Connection timed out." };
    }
    return { success: false, message: "Could not reach ElevenLabs. Check your network." };
  }
};

const notion: TestHandler = async (creds) => {
  const key = creds.apiKey;
  if (!key) return { success: false, message: "Integration token is required" };
  try {
    const res = await fetchWithTimeout("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${key}`,
        "Notion-Version": "2022-06-28",
      },
    });
    if (res.ok) return { success: true, message: "Connected to Notion!" };
    if (res.status === 401) {
      return { success: false, message: "Invalid integration token." };
    }
    return { success: false, message: `Notion returned ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, message: "Connection timed out." };
    }
    return { success: false, message: "Could not reach Notion." };
  }
};

const github: TestHandler = async (creds) => {
  const token = creds.apiKey;
  if (!token) return { success: false, message: "Token is required" };
  try {
    const res = await fetchWithTimeout("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (res.ok) {
      const data = (await res.json()) as { login?: string };
      return { success: true, message: `Connected as @${data.login ?? "unknown"}` };
    }
    if (res.status === 401) {
      return { success: false, message: "Invalid token." };
    }
    return { success: false, message: `GitHub returned ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, message: "Connection timed out." };
    }
    return { success: false, message: "Could not reach GitHub." };
  }
};

const brave_search: TestHandler = async (creds) => {
  const key = creds.apiKey;
  if (!key) return { success: false, message: "API key is required" };
  try {
    const res = await fetchWithTimeout(
      "https://api.search.brave.com/res/v1/web/search?q=test&count=1",
      { headers: { "X-Subscription-Token": key, Accept: "application/json" } },
    );
    if (res.ok) {
      return { success: true, message: "Connected to Brave Search!" };
    }
    if (res.status === 401 || res.status === 403) {
      return { success: false, message: "Invalid API key." };
    }
    return { success: false, message: `Brave Search returned ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, message: "Connection timed out." };
    }
    return { success: false, message: "Could not reach Brave Search." };
  }
};

const openai: TestHandler = async (creds) => {
  const key = creds.apiKey;
  if (!key) return { success: false, message: "API key is required" };
  try {
    const res = await fetchWithTimeout("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      return { success: true, message: "Connected to OpenAI!" };
    }
    if (res.status === 401) {
      return { success: false, message: "Invalid API key." };
    }
    return { success: false, message: `OpenAI returned ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, message: "Connection timed out." };
    }
    return { success: false, message: "Could not reach OpenAI." };
  }
};

const google_places: TestHandler = async (creds) => {
  const key = creds.apiKey;
  if (!key) return { success: false, message: "API key is required" };
  try {
    // Use a lightweight text search to validate the key
    const res = await fetchWithTimeout(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.displayName",
        },
        body: JSON.stringify({ textQuery: "test", maxResultCount: 1 }),
      },
    );
    if (res.ok) {
      return { success: true, message: "Connected to Google Places!" };
    }
    if (res.status === 403) {
      return { success: false, message: "API key not authorized for Places API." };
    }
    return { success: false, message: `Google Places returned ${res.status}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, message: "Connection timed out." };
    }
    return { success: false, message: "Could not reach Google Places." };
  }
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All registered connection test handlers, keyed by credential template key. */
export const CONNECTION_TEST_HANDLERS: Record<string, TestHandler> = {
  gmail,
  elevenlabs,
  notion,
  github,
  brave_search,
  openai,
  google_places,
};

/**
 * Run a connection test for the given template key.
 * Returns null if no handler is registered (caller decides how to handle).
 */
export function runConnectionTest(
  templateKey: string,
  credentials: Record<string, string>,
): Promise<ConnectionTestResult> | null {
  const handler = CONNECTION_TEST_HANDLERS[templateKey];
  if (!handler) return null;
  return handler(credentials);
}
