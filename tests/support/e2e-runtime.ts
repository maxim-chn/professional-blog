import {
  loadPersistenceConfig,
  type PersistenceConfig,
} from '../../src/lib/persistence/config.ts';
import { requireInput } from '../../src/lib/persistence/errors.ts';
import {
  loadPublicationConfig,
  type PublicationConfig,
} from '../../src/lib/publication/config.ts';
import {
  loadAstroRuntimeConfig,
  type AstroRuntimeConfig,
} from '../../src/lib/server/config.ts';
import { isNonEmptyString } from '../../src/lib/utilities/string_kit.ts';

const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', 'localhost'];

export interface E2eRuntime {
  runtimeConfigFile: string;
  runtime: AstroRuntimeConfig;
  publication: PublicationConfig;
  persistence: PersistenceConfig;
  host: string;
  port: number;
}

export async function loadE2eRuntime(
  runtimeConfigFile: string,
  rootOverride?: string,
): Promise<E2eRuntime> {
  const runtime = await loadAstroRuntimeConfig(runtimeConfigFile);
  const publication = await loadPublicationConfig(runtime.publicationConfig);
  const persistence = await loadPersistenceConfig(
    publication.persistenceConfig,
    rootOverride,
  );
  const origin = new URL(publication.visitorOrigin);
  requireInput(
    origin.protocol === 'http:' && LOOPBACK_HOSTS.includes(origin.hostname),
    'E2E visitor origin must use HTTP on a loopback host',
  );
  requireInput(
    isNonEmptyString(origin.port),
    'E2E visitor origin must include a non-default TCP port',
  );
  const port = Number(origin.port);
  requireInput(
    Number.isSafeInteger(port) && port > 0 && port <= 65535,
    'E2E server port must be between 1 and 65535',
  );

  return {
    runtimeConfigFile,
    runtime,
    publication,
    persistence,
    host: origin.hostname,
    port,
  };
}
