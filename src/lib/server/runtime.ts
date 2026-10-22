import { requireInput } from '../persistence/errors.ts';
import { isNonEmpty } from '../utilities/string_kit.ts';
import {
  createRuntimePersistence,
  type RuntimePersistence,
} from './persistence.ts';

export async function loadRuntime(): Promise<RuntimePersistence> {
  const configurationFile = process.env.ASTRO_RUNTIME_CONFIG;
  requireInput(
    isNonEmpty(configurationFile),
    'ASTRO_RUNTIME_CONFIG must identify the runtime configuration file',
  );

  return createRuntimePersistence(configurationFile, () => new Date(), {
    root: process.env.PERSISTENCE_ROOT,
    visitorOrigin: process.env.VISITOR_ORIGIN,
  });
}
