/**
 * GET /api/artifacts/templates
 *
 * Returns all document templates available across all persona Starter Kits.
 * Used by the Artifacts panel "New from Template" dialog to populate the
 * template picker.
 *
 * Returns: { templates: DocTemplateEntry[] }
 */
import { NextResponse } from "next/server";
import { listAllDocTemplates } from "@/features/personas/lib/documentTemplates";
import { handleApiError } from "@/lib/api/helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const templates = listAllDocTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    return handleApiError(err, "artifacts/templates GET", "Failed to load document templates.");
  }
}
