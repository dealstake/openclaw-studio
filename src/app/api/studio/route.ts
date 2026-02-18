import { NextResponse } from "next/server";

import { type StudioSettingsPatch } from "@/lib/studio/settings";
import { applyStudioSettingsPatch, loadStudioSettings } from "@/lib/studio/settings-store";
import { handleApiError } from "@/lib/api/helpers";

export const runtime = "nodejs";

const isPatch = (value: unknown): value is StudioSettingsPatch =>
  Boolean(value && typeof value === "object");

export async function GET() {
  try {
    const settings = loadStudioSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return handleApiError(err, "studio GET", "Failed to load studio settings.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!isPatch(body)) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }
    const settings = applyStudioSettingsPatch(body);
    return NextResponse.json({ settings });
  } catch (err) {
    return handleApiError(err, "studio PUT", "Failed to save studio settings.");
  }
}
