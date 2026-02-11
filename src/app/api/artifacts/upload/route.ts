import { NextResponse } from "next/server";
import { uploadFile } from "@/lib/google/drive";

export const runtime = "nodejs";

const ARTIFACTS_INTERNAL_KEY = process.env.ARTIFACTS_INTERNAL_KEY || "";

export async function POST(request: Request) {
  // Internal key auth for proxy mode
  if (ARTIFACTS_INTERNAL_KEY) {
    const providedKey = request.headers.get("X-Internal-Key") || "";
    if (providedKey !== ARTIFACTS_INTERNAL_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folderId = formData.get("folderId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(
      file.name,
      buffer,
      file.type || "application/octet-stream",
      typeof folderId === "string" ? folderId : undefined
    );

    return NextResponse.json({ file: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    console.error("[artifacts/upload]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
