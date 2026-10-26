import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { E2eRuntime } from './e2e-runtime.ts';

const executeFile = promisify(execFile);
const PUBLICATION_CLI = fileURLToPath(
  new URL('../../scripts/publish-post.ts', import.meta.url),
);

export async function runPublicationCli(
  runtime: E2eRuntime,
  manifestFile: string,
  timeoutMs: number,
): Promise<{ result: unknown; stdout: string; stderr: string }> {
  assert.ok(isAbsolute(manifestFile), 'Publication manifest must be absolute');
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0);
  const { stdout, stderr } = await executeFile(
    process.execPath,
    [
      '--experimental-strip-types',
      PUBLICATION_CLI,
      '--config',
      runtime.runtime.publicationConfig,
      '--manifest',
      manifestFile,
      '--root',
      runtime.persistence.root,
    ],
    { timeout: timeoutMs, killSignal: 'SIGKILL', encoding: 'utf8' },
  );
  const result: unknown = JSON.parse(stdout);
  return { result, stdout, stderr };
}
