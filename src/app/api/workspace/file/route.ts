import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import {
  isTextFile,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "@/lib/workspace/resolve";

export const runtime = "nodejs";

/**
 * GET /api/workspace/file?agentId=<id>&path=<relative>
 *
 * Read a single file from an agent's workspace.
 * Proxies to sidecar when running on Cloud Run.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path")?.trim() ?? "";

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing required query parameter: path" },
        { status: 400 }
      );
    }

    return await withSidecarGetFallback("/file", { agentId, path: filePath }, () => {
      const result = readWorkspaceFile(agentId, filePath);
      return {
        agentId,
        path: result.path,
        content: result.content,
        size: result.size,
        updatedAt: result.updatedAt,
        isText: result.isText,
      };
    });
  } catch (err) {
    return handleApiError(err, "workspace/file GET", "Failed to read workspace file.");
  }
}

/**
 * PUT /api/workspace/file
 *
 * Write content to a file in the agent's workspace.
 * Body: { agentId, path, content }
 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { agentId, path: filePath, content } = body as {
      agentId?: string;
      path?: string;
      content?: string;
    };

    const validation = validateAgentId(agentId);
    if (!validation.ok) return validation.error;

    const trimmedPath = typeof filePath === "string" ? filePath.trim() : "";

    if (!trimmedPath) {
      return NextResponse.json(
        { error: "Missing required field: path" },
        { status: 400 }
      );
    }

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing required field: content (must be a string)" },
        { status: 400 }
      );
    }

    if (!isTextFile(trimmedPath)) {
      return NextResponse.json(
        { error: "Only text files can be written via this endpoint." },
        { status: 400 }
      );
    }

    return await withSidecarMutateFallback(
      "/file",
      "PUT",
      { agentId: validation.agentId, path: trimmedPath, content },
      () => {
        const result = writeWorkspaceFile(validation.agentId, trimmedPath, content);
        return {
          agentId: validation.agentId,
          path: result.path,
          size: result.size,
          ok: true,
        };
      },
    );
  } catch (err) {
    return handleApiError(err, "workspace/file PUT", "Failed to write workspace file.");
  }
}
