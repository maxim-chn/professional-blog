import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isMap } from '../../src/lib/utilities/map_kit.ts';

const HTTP_SERVER_CONFIG = new URL(
  '../config/http-server.json',
  import.meta.url,
);

export interface HttpServerConfig {
  host: string;
  port: number;
  startupTimeoutMs: number;
  shutdownTimeoutMs: number;
}

export async function loadHttpServerConfig(): Promise<HttpServerConfig> {
  const raw: unknown = JSON.parse(await readFile(HTTP_SERVER_CONFIG, 'utf8'));
  assert.ok(isMap(raw), 'HTTP test configuration must be an object');

  const { host, port, startupTimeoutMs, shutdownTimeoutMs } = raw;
  assert.equal(host, '127.0.0.1', 'HTTP tests must bind to IPv4 loopback');
  assert.ok(
    typeof port === 'number' &&
      Number.isSafeInteger(port) &&
      port >= 0 &&
      port <= 65535,
    'HTTP test port must be an integer between 0 and 65535',
  );
  assert.ok(
    typeof startupTimeoutMs === 'number' &&
      Number.isSafeInteger(startupTimeoutMs) &&
      startupTimeoutMs > 0,
    'HTTP test startup timeout must be a positive integer',
  );
  assert.ok(
    typeof shutdownTimeoutMs === 'number' &&
      Number.isSafeInteger(shutdownTimeoutMs) &&
      shutdownTimeoutMs > 0,
    'HTTP test shutdown timeout must be a positive integer',
  );

  return { host, port, startupTimeoutMs, shutdownTimeoutMs };
}
