import type { WizardTaskConfig } from "@/features/tasks/types";

/**
 * Extract a task config JSON block from assistant message text.
 * Prefers ```json:task-config fenced blocks, falls back to ```json blocks.
 */
export function extractTaskConfig(
  text: string,
): { config: WizardTaskConfig; fullMatch: string; startIndex: number } | null {
  const match =
    text.match(/```json:task-config\s*\n([\s\S]*?)```/) ??
    text.match(/```json\s*\n([\s\S]*?)```/);
  if (!match || match.index === undefined) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (
      parsed &&
      typeof parsed === "object" &&
      ("schedule" in parsed || "prompt" in parsed)
    ) {
      return {
        config: parsed as WizardTaskConfig,
        fullMatch: match[0],
        startIndex: match.index,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Strip JSON config blocks and leftover JSON fragments from text,
 * leaving only the prose content.
 */
export function stripConfigBlock(text: string): string {
  let stripped = text
    .replace(/```json:task-config\s*\n[\s\S]*?```/g, "")
    .replace(/```json\s*\n[\s\S]*?```/g, "")
    .replace(/```\s*\n\{[\s\S]*?\}\s*\n```/g, "");
  stripped = stripped
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^["{}\[\],:\s]*$/.test(t)) return false;
      if (/^"?\s*\}/.test(t) && t.length < 10) return false;
      return true;
    })
    .join("\n")
    .trim();
  return stripped;
}
