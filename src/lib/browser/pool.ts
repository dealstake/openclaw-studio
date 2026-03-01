/**
 * Browser Pool — bounded concurrency manager for document generation.
 *
 * Phase 2 uses this as a simple concurrency semaphore (no actual browser
 * processes). When playwright-core is added as a production dependency in a
 * future phase, this module will be extended to manage a pool of real browser
 * instances — the API surface is already designed for that evolution.
 *
 * Key properties:
 *  - Singleton per process (module-level state)
 *  - Bounded concurrency: max N concurrent operations (default: 3)
 *  - Queue with FIFO ordering — excess requests wait, not rejected
 *  - Per-request timeout (default: 30s) to prevent queue starvation
 *  - Graceful shutdown: drains queue, rejects new acquisitions
 *  - Zero dependencies (uses native Promise + setTimeout)
 *
 * @module
 *
 * @example
 *   import { acquireSlot, releaseSlot } from "@/lib/browser/pool";
 *
 *   const token = await acquireSlot({ timeoutMs: 15_000 });
 *   try {
 *     // ... expensive rendering work ...
 *   } finally {
 *     releaseSlot(token);
 *   }
 *
 *   // Or use the convenience wrapper:
 *   const result = await withSlot(async () => doWork(), { timeoutMs: 15_000 });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Opaque token returned by acquireSlot, required to call releaseSlot. */
export interface PoolSlot {
  readonly id: number;
  readonly acquiredAt: number;
}

export interface PoolOptions {
  /** Maximum simultaneous operations. Default: 3. */
  maxConcurrent?: number;
  /** Default per-acquisition timeout in ms. Default: 30_000. */
  defaultTimeoutMs?: number;
}

export interface AcquireOptions {
  /** Override the pool default timeout for this specific acquisition. */
  timeoutMs?: number;
}

export interface PoolStats {
  /** Number of slots currently in use. */
  active: number;
  /** Number of requests waiting in queue. */
  queued: number;
  /** Pool capacity. */
  maxConcurrent: number;
  /** Whether the pool is shutting down. */
  shuttingDown: boolean;
}

// ---------------------------------------------------------------------------
// Pool implementation
// ---------------------------------------------------------------------------

interface QueueEntry {
  resolve: (slot: PoolSlot) => void;
  reject: (err: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

class BrowserPool {
  private readonly maxConcurrent: number;
  private readonly defaultTimeoutMs: number;
  private active = 0;
  private nextId = 1;
  private readonly queue: QueueEntry[] = [];
  private isShuttingDown = false;

  constructor(opts: PoolOptions = {}) {
    this.maxConcurrent = opts.maxConcurrent ?? 3;
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 30_000;
  }

  /**
   * Acquire a concurrency slot. Resolves immediately if a slot is available,
   * otherwise queues and resolves when a slot becomes free.
   *
   * Rejects with a timeout error if the caller waits longer than `timeoutMs`.
   * Rejects immediately if the pool is shutting down.
   */
  acquire(opts: AcquireOptions = {}): Promise<PoolSlot> {
    if (this.isShuttingDown) {
      return Promise.reject(new Error("BrowserPool is shutting down"));
    }

    if (this.active < this.maxConcurrent) {
      // Slot available immediately
      this.active++;
      const slot: PoolSlot = { id: this.nextId++, acquiredAt: Date.now() };
      return Promise.resolve(slot);
    }

    // Queue the request
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<PoolSlot>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve,
        reject,
        timeoutHandle: setTimeout(() => {
          // Remove from queue and reject
          const idx = this.queue.indexOf(entry);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
          }
          reject(
            new Error(
              `BrowserPool: acquisition timed out after ${timeoutMs}ms (active=${this.active}, queued=${this.queue.length})`,
            ),
          );
        }, timeoutMs),
      };
      this.queue.push(entry);
    });
  }

  /**
   * Release a previously acquired slot back to the pool.
   * If there are waiters in the queue, the next one is immediately resolved.
   */
  release(slot: PoolSlot): void {
    // Validate ownership (best-effort; slot ids are sequential)
    if (slot.id <= 0) {
      console.error("[BrowserPool] release() called with invalid slot");
      return;
    }

    if (this.queue.length > 0) {
      // Hand off to next waiter — do not decrement active (stays at same level)
      const next = this.queue.shift();
      if (next) {
        clearTimeout(next.timeoutHandle);
        const newSlot: PoolSlot = { id: this.nextId++, acquiredAt: Date.now() };
        next.resolve(newSlot);
      }
    } else {
      this.active = Math.max(0, this.active - 1);
    }
  }

  /**
   * Run `fn` inside a pool slot, automatically releasing when done.
   *
   * @throws Propagates any error from `fn` (slot is still released).
   */
  async run<T>(fn: () => Promise<T>, opts: AcquireOptions = {}): Promise<T> {
    const slot = await this.acquire(opts);
    try {
      return await fn();
    } finally {
      this.release(slot);
    }
  }

  /** Current pool statistics (for monitoring / health endpoints). */
  stats(): PoolStats {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      shuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Initiate graceful shutdown.
   * - Rejects all pending queue entries immediately.
   * - New `acquire()` calls will reject.
   * - Active slots are not forcibly terminated — callers should observe the
   *   `shuttingDown` flag and clean up gracefully.
   */
  shutdown(): void {
    this.isShuttingDown = true;
    for (const entry of this.queue) {
      clearTimeout(entry.timeoutHandle);
      entry.reject(new Error("BrowserPool: pool shut down"));
    }
    this.queue.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

const POOL_MAX = parseInt(process.env.DOCUMENT_POOL_MAX ?? "3", 10);
const POOL_TIMEOUT_MS = parseInt(process.env.DOCUMENT_POOL_TIMEOUT_MS ?? "30000", 10);

/**
 * Global singleton pool instance.
 * Configured via env vars:
 *   DOCUMENT_POOL_MAX          — max concurrent slots (default: 3)
 *   DOCUMENT_POOL_TIMEOUT_MS   — acquisition timeout in ms (default: 30000)
 */
const pool = new BrowserPool({ maxConcurrent: POOL_MAX, defaultTimeoutMs: POOL_TIMEOUT_MS });

// ---------------------------------------------------------------------------
// Public API (module-level wrappers around the singleton)
// ---------------------------------------------------------------------------

/**
 * Acquire a concurrency slot from the global pool.
 * Must be paired with a `releaseSlot()` call (prefer `withSlot()` instead).
 */
export function acquireSlot(opts?: AcquireOptions): Promise<PoolSlot> {
  return pool.acquire(opts);
}

/**
 * Release a slot back to the global pool.
 */
export function releaseSlot(slot: PoolSlot): void {
  pool.release(slot);
}

/**
 * Run `fn` inside a pool slot — the preferred high-level API.
 * Slot is acquired before calling `fn` and released when `fn` settles.
 *
 * @example
 *   const html = await withSlot(() => generatePrintHtml(markdown));
 */
export function withSlot<T>(fn: () => Promise<T>, opts?: AcquireOptions): Promise<T> {
  return pool.run(fn, opts);
}

/**
 * Get current pool statistics.
 */
export function getPoolStats(): PoolStats {
  return pool.stats();
}

/**
 * Shut down the pool (call during process exit / graceful shutdown hooks).
 */
export function shutdownPool(): void {
  pool.shutdown();
}
