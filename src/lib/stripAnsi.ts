/**
 * Shared ANSI escape code stripping utility.
 *
 * Matches CSI sequences (colors, cursor movement), OSC sequences,
 * and character set designations. Single source of truth — do not
 * duplicate this regex elsewhere.
 */

export const ANSI_RE =
  /(\x9B|\x1B\[)[0-?]*[ -/]*[@-~]|\x1B\][^\x07]*\x07|\x1B[()][A-B0-9]/g;

/**
 * Strip ANSI escape codes from a string.
 * Used to convert raw terminal output into plain text for display + indexing.
 */
export function stripAnsi(raw: string): string {
  return raw.replace(ANSI_RE, "");
}
