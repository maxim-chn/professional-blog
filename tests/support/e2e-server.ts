import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { isMap } from '../../src/lib/utilities/map_kit.ts';
import { isNonEmpty } from '../../src/lib/utilities/string_kit.ts';
import type { E2eConfig } from './e2e-config.ts';
import type { E2eRuntime } from './e2e-runtime.ts';
import { runWithCleanup } from './run-with-cleanup.ts';

const SERVER_PROCESS = new URL('../runtime/server-process.ts', import.meta.url);

export interface E2eServer {
  origin: string;
  stop(): Promise<void>;
  getOutput(): string;
}

export async function startE2eServer(
  runtime: E2eRuntime,
  settings: Pick<E2eConfig, 'startupTimeoutMs' | 'shutdownTimeoutMs'>,
): Promise<E2eServer> {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    HOST: runtime.host,
    PORT: String(runtime.port),
    ASTRO_RUNTIME_CONFIG: runtime.runtimeConfigFile,
    PERSISTENCE_ROOT: runtime.persistence.root,
  };
  delete environment.SERVER_CERT_PATH;
  delete environment.SERVER_KEY_PATH;
  delete environment.VISITOR_ORIGIN;

  const child = fork(SERVER_PROCESS, [], {
    env: environment,
    execArgv: ['--experimental-strip-types'],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    output += String(chunk);
  });
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.once('error', (error) => {
      output += String(error);
      resolve();
    });
  });

  let stopPromise: Promise<void> | undefined;
  async function shutdown(): Promise<void> {
    assert.ok(
      child.exitCode === null &&
        child.signalCode === null &&
        child.pid !== undefined,
      `E2E server exited before shutdown.\n${output}`,
    );
    const timer = setTimeout(
      () => child.kill('SIGKILL'),
      settings.shutdownTimeoutMs,
    );
    try {
      child.kill('SIGTERM');
      await exited;
      assert.equal(child.exitCode, 0, `E2E server shutdown failed.\n${output}`);
      assert.equal(
        child.signalCode,
        null,
        'E2E server required forced termination',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  function stop(): Promise<void> {
    stopPromise ??= shutdown();
    return stopPromise;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.startupTimeoutMs);
  try {
    const [message] = await Promise.race([
      once(child, 'message', { signal: controller.signal }),
      exited.then(() => {
        throw new Error('E2E server exited before readiness');
      }),
    ]);
    assert.ok(
      isMap(message) && message.type === 'ready' && isNonEmpty(message.origin),
      'E2E server must report its ready origin',
    );
    assert.equal(
      message.origin,
      runtime.publication.visitorOrigin,
      'E2E server and publication origins must match',
    );
    return { origin: message.origin, stop, getOutput: () => output };
  } catch (cause) {
    const startupError = new Error(`E2E server failed to start.\n${output}`, {
      cause,
    });
    if (
      child.exitCode === null &&
      child.signalCode === null &&
      child.pid !== undefined
    ) {
      await runWithCleanup(async () => {
        throw startupError;
      }, stop);
    }
    throw startupError;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
