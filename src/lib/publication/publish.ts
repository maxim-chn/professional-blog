import { loadPersistenceConfig } from '../persistence/config.ts';
import type { CreateResult } from '../persistence/contract.ts';
import { FileSystemAdapter } from '../persistence/filesystem.ts';
import { PersistenceService } from '../persistence/service.ts';
import { loadPublicationBundle } from './bundle.ts';
import type { PublicationConfig } from './config.ts';
import { buildVisitorUrl } from './visitor-url.ts';

export type PublicationResult = CreateResult & { visitor_url: string };

export async function publishManifest(
  manifestFile: URL | string,
  config: PublicationConfig,
  clock: () => Date,
  rootOverride?: string,
): Promise<PublicationResult> {
  const persistenceConfig = await loadPersistenceConfig(
    config.persistenceConfig,
    rootOverride,
  );
  const bundle = await loadPublicationBundle(manifestFile, persistenceConfig);
  const visitorUrl = buildVisitorUrl(config.visitorOrigin, bundle.post.id);
  const service = new PersistenceService(
    new FileSystemAdapter(persistenceConfig),
    persistenceConfig,
    clock,
  );
  const result = await service.createPost(
    bundle.post,
    bundle.metadata,
    bundle.contents,
    bundle.media,
  );

  return { ...result, visitor_url: visitorUrl };
}
