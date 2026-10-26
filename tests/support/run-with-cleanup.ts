export async function runWithCleanup<T>(
  operation: () => Promise<T>,
  cleanup: () => Promise<void>,
): Promise<T> {
  let outcome:
    { succeeded: true; value: T } | { succeeded: false; error: unknown };

  try {
    outcome = { succeeded: true, value: await operation() };
  } catch (error) {
    outcome = { succeeded: false, error };
  }

  let cleanupOutcome:
    { succeeded: true } | { succeeded: false; error: unknown };
  try {
    await cleanup();
    cleanupOutcome = { succeeded: true };
  } catch (error) {
    cleanupOutcome = { succeeded: false, error };
  }

  if (!cleanupOutcome.succeeded) {
    if (!outcome.succeeded) {
      throw new AggregateError(
        [outcome.error, cleanupOutcome.error],
        'E2E operation and cleanup both failed',
        { cause: outcome.error },
      );
    }
    throw cleanupOutcome.error;
  }

  if (!outcome.succeeded) {
    throw outcome.error;
  }
  return outcome.value;
}
