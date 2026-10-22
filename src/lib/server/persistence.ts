import { loadPersistenceConfig } from '../persistence/config.ts';
import { FileSystemAdapter } from '../persistence/filesystem.ts';
import { PersistenceService } from '../persistence/service.ts';
import { loadPublicationConfig } from '../publication/config.ts';
import { resolveVisitorOrigin } from '../publication/visitor-url.ts';
import { loadAstroRuntimeConfig } from './config.ts';

export interface RuntimeOverrides {
  root?: string;
  visitorOrigin?: string;
}

export interface RuntimePersistence {
  service: PersistenceService;
  cataloguePageSize: number;
  visitorOrigin: string;
}

export async function createRuntimePersistence(
  file: URL | string,
  clock: () => Date,
  overrides?: RuntimeOverrides,
): Promise<RuntimePersistence> {
  const runtime = await loadAstroRuntimeConfig(file);
  const publication = await loadPublicationConfig(runtime.publicationConfig);
  const persistence = await loadPersistenceConfig(
    publication.persistenceConfig,
    overrides?.root,
  );
  const visitorOrigin = resolveVisitorOrigin(
    overrides?.visitorOrigin === undefined
      ? publication.visitorOrigin
      : overrides.visitorOrigin,
  );
  const service = new PersistenceService(
    new FileSystemAdapter(persistence),
    persistence,
    clock,
  );

  return {
    service,
    cataloguePageSize: runtime.cataloguePageSize,
    visitorOrigin,
  };
}
