/**
 * Connection test API route for credential templates.
 *
 * POST /api/integrations/test
 * Body: { templateId: string; credentials: Record<string, string> }
 * Returns: { success: boolean; message: string }
 */

import { NextResponse } from "next/server";

interface TestRequest {
  templateId: string;
  credentials: Record<string, string>;
}

interface TestResponse {
  success: boolean;
  message: string;
}

type TestHandler = (
  creds: Record<string, string>,
) => Promise<TestResponse>;

const HANDLERS: Record<string, TestHandler> = {
  gmail: async (creds) => {
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
  },

  elevenlabs: async (creds) => {
    const key = creds.apiKey;
    if (!key) return { success: false, message: "API key is required" };
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": key },
      });
      if (res.ok) {
        return { success: true, message: "Connected! Found your ElevenLabs voices." };
      }
      if (res.status === 401) {
        return { success: false, message: "Invalid API key." };
      }
      return { success: false, message: `ElevenLabs returned ${res.status}` };
    } catch {
      return {
        success: false,
        message: "Could not reach ElevenLabs. Check your network.",
      };
    }
  },

  notion: async (creds) => {
    const key = creds.apiKey;
    if (!key) return { success: false, message: "Integration token is required" };
    try {
      const res = await fetch("https://api.notion.com/v1/users/me", {
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
    } catch {
      return { success: false, message: "Could not reach Notion." };
    }
  },

  github: async (creds) => {
    const token = creds.apiKey;
    if (!token) return { success: false, message: "Token is required" };
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { login?: string };
        return {
          success: true,
          message: `Connected as @${data.login ?? "unknown"}`,
        };
      }
      if (res.status === 401) {
        return { success: false, message: "Invalid token." };
      }
      return { success: false, message: `GitHub returned ${res.status}` };
    } catch {
      return { success: false, message: "Could not reach GitHub." };
    }
  },
};

export async function POST(
  request: Request,
): Promise<NextResponse<TestResponse>> {
  try {
    const body = (await request.json()) as TestRequest;
    const handler = HANDLERS[body.templateId];

    if (!handler) {
      return NextResponse.json(
        { success: false, message: "Unknown integration" },
        { status: 400 },
      );
    }

    const result = await handler(body.credentials);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { success: false, message: "Test failed unexpectedly" },
      { status: 500 },
    );
  }
}
