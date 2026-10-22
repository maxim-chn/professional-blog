import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { isAbsolute } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isMap } from '../../src/lib/utilities/map_kit.ts';
import { isNonEmpty } from '../../src/lib/utilities/string_kit.ts';
import { TEST_RUNTIME_CONFIG } from './fixtures.ts';
import { loadHttpServerConfig } from './server-config.ts';

const SERVER_PROCESS = new URL('./server-process.ts', import.meta.url);

export async function startHttpServer(t: TestContext, root: string) {
  assert.ok(isAbsolute(root), 'HTTP tests require an absolute storage root');
  const config = await loadHttpServerConfig();
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    HOST: config.host,
    PORT: String(config.port),
    ASTRO_RUNTIME_CONFIG: fileURLToPath(TEST_RUNTIME_CONFIG),
    PERSISTENCE_ROOT: root,
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
    child.once('error', () => resolve());
  });

  t.after(async () => {
    if (
      child.exitCode !== null ||
      child.signalCode !== null ||
      child.pid === undefined
    ) {
      return;
    }
    const timer = setTimeout(
      () => child.kill('SIGKILL'),
      config.shutdownTimeoutMs,
    );
    try {
      child.kill('SIGTERM');
      await exited;
      assert.equal(child.exitCode, 0, output);
    } finally {
      clearTimeout(timer);
    }
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.startupTimeoutMs);
  try {
    const [message] = await Promise.race([
      once(child, 'message', { signal: controller.signal }),
      exited.then(() => {
        throw new Error('HTTP test server exited before readiness');
      }),
    ]);
    assert.ok(
      isMap(message) && message.type === 'ready' && isNonEmpty(message.origin),
    );
    const origin = new URL(message.origin);
    assert.equal(origin.protocol, 'http:');
    assert.equal(origin.hostname, config.host);
    return origin.origin;
  } catch (cause) {
    throw new Error(`HTTP test server failed to start.\n${output}`, { cause });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
