import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { isNonEmpty } from '../../src/lib/utilities/string_kit.ts';

const SERVER_ENTRY = new URL('../../dist/server/entry.mjs', import.meta.url);

interface RunningServer {
  server: {
    server: Server;
    stop(): Promise<void>;
  };
  done: Promise<void>;
}

try {
  const host = process.env.HOST;
  assert.ok(isNonEmpty(host), 'The test launcher must supply HOST');
  const send = process.send?.bind(process);
  assert.ok(send, 'The test server requires an IPC connection');

  process.env.ASTRO_NODE_AUTOSTART = 'disabled';
  process.env.ASTRO_NODE_LOGGING = 'disabled';

  const { startServer } = (await import(SERVER_ENTRY.href)) as {
    startServer(): RunningServer;
  };
  const running = startServer();

  void running.done.catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

  process.once('SIGTERM', () => {
    void running.server.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error);
        process.exit(1);
      },
    );
  });

  if (!running.server.server.listening) {
    await once(running.server.server, 'listening');
  }

  const address = running.server.server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const origin = new URL(`http://${host}`);
  origin.port = String(address.port);
  process.env.VISITOR_ORIGIN = origin.origin;

  send({ type: 'ready', origin: origin.origin });
} catch (error) {
  console.error(error);
  process.exit(1);
}
