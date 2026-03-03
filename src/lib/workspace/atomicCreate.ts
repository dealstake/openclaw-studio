/**
 * Atomic multi-step creation with rollback.
 *
 * Executes a sequence of steps. If any step fails, all previously
 * completed steps are rolled back in reverse order.
 *
 * @example
 * ```ts
 * const result = await atomicCreate([
 *   {
 *     name: "Register gateway agent",
 *     execute: async () => { await registerAgent(name); },
 *     rollback: async () => { await unregisterAgent(name); },
 *   },
 *   {
 *     name: "Create agent files",
 *     execute: async () => { await createFiles(agentId); },
 *     rollback: async () => { await deleteFiles(agentId); },
 *   },
 * ]);
 * ```
 */

export interface AtomicStep {
  /** Human-readable step name for error messages */
  name: string;
  /** Execute the step. Throw to trigger rollback of prior steps. */
  execute: () => Promise<void>;
  /** Undo this step. Called during rollback (best-effort, errors logged). */
  rollback?: () => Promise<void>;
}

export interface AtomicResult {
  success: boolean;
  /** Which step failed (undefined if success) */
  failedStep?: string;
  /** Error message from the failed step */
  error?: string;
  /** Steps that failed to rollback (best-effort) */
  rollbackErrors?: string[];
}

/**
 * Execute steps sequentially with automatic rollback on failure.
 */
export async function atomicCreate(steps: AtomicStep[]): Promise<AtomicResult> {
  const completed: AtomicStep[] = [];

  for (const step of steps) {
    try {
      await step.execute();
      completed.push(step);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      // Rollback completed steps in reverse order
      const rollbackErrors: string[] = [];
      for (let i = completed.length - 1; i >= 0; i--) {
        const prev = completed[i]!;
        if (prev.rollback) {
          try {
            await prev.rollback();
          } catch (rbErr) {
            rollbackErrors.push(
              `${prev.name}: ${rbErr instanceof Error ? rbErr.message : String(rbErr)}`,
            );
          }
        }
      }

      return {
        success: false,
        failedStep: step.name,
        error,
        rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : undefined,
      };
    }
  }

  return { success: true };
}
