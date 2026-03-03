/**
 * Global chunk loading error recovery.
 *
 * After a deployment, old chunk URLs become invalid. React.lazy / next/dynamic
 * will throw ChunkLoadError when trying to import them. This listener catches
 * those errors and triggers a single page reload to fetch fresh chunks.
 *
 * Call `installChunkErrorRecovery()` once from a top-level client component.
 */

const RELOAD_KEY = "__chunk_reload";

export function installChunkErrorRecovery(): () => void {
  function isChunkError(e: unknown): boolean {
    if (e instanceof Error) {
      const msg = e.message || "";
      return (
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed")
      );
    }
    return false;
  }

  function handleError(event: ErrorEvent): void {
    if (!isChunkError(event.error)) return;
    // Prevent infinite reload loops — only retry once per session
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
  }

  function handleRejection(event: PromiseRejectionEvent): void {
    if (!isChunkError(event.reason)) return;
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
  }

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  // Clear the flag on successful load so future deploys can trigger reload
  sessionStorage.removeItem(RELOAD_KEY);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
