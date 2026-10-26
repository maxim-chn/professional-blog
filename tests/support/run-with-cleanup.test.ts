import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runWithCleanup } from './run-with-cleanup.ts';

test('waits for cleanup before returning the operation result', async () => {
  const events: string[] = [];
  const expected = { completed: true };

  const result = await runWithCleanup(
    async () => {
      events.push('operation');
      return expected;
    },
    async () => {
      events.push('cleanup started');
      await setImmediate();
      events.push('cleanup finished');
    },
  );
  events.push('returned');

  assert.equal(result, expected);
  assert.deepEqual(events, [
    'operation',
    'cleanup started',
    'cleanup finished',
    'returned',
  ]);
});

test('runs cleanup once after an operation failure and preserves the original error', async () => {
  const failure = new Error('Original operation failure');
  let cleanupCalls = 0;

  await assert.rejects(
    runWithCleanup(
      () => {
        throw failure;
      },
      async () => {
        cleanupCalls += 1;
      },
    ),
    (error: unknown) => error === failure,
  );
  assert.equal(cleanupCalls, 1);
});

test('fails when cleanup rejects after a successful operation', async () => {
  const failure = new Error('Cleanup failure');

  await assert.rejects(
    runWithCleanup(
      async () => 'Operation succeeded',
      async () => {
        throw failure;
      },
    ),
    (error: unknown) => error === failure,
  );
});

test('preserves both errors when the operation and cleanup fail', async () => {
  const operationFailure = new Error('Original assertion failure');
  const cleanupFailure = new Error('Restoration failure');
  let cleanupCalls = 0;

  await assert.rejects(
    runWithCleanup(
      async () => {
        throw operationFailure;
      },
      () => {
        cleanupCalls += 1;
        throw cleanupFailure;
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.message, 'E2E operation and cleanup both failed');
      assert.equal(error.cause, operationFailure);
      assert.deepEqual(error.errors, [operationFailure, cleanupFailure]);
      return true;
    },
  );
  assert.equal(cleanupCalls, 1);
});

test('does not mistake an undefined rejection for success', async () => {
  let cleanupCalls = 0;
  const outcome = await runWithCleanup(
    () => Promise.reject(undefined),
    async () => {
      cleanupCalls += 1;
    },
  ).then(
    () => ({ succeeded: true }),
    (error: unknown) => ({ succeeded: false, error }),
  );

  assert.deepEqual(outcome, { succeeded: false, error: undefined });
  assert.equal(cleanupCalls, 1);
});
