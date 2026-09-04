/** Small retry helper — used for the Friendbot-then-Horizon ledger-visibility lag, where a
 *  freshly-funded account can 404 on Horizon for a moment after Friendbot returns success. */
export interface RetryOptions {
  attempts: number;
  delayMs: number;
  /** Only retry when this returns true; any other error rethrows immediately. */
  retryOn: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts || !options.retryOn(error)) {
        throw error;
      }
      await sleep(options.delayMs);
    }
  }
  // Unreachable — the loop above always either returns or throws — but keeps TypeScript happy.
  throw lastError;
}
