import type { ListResult } from '../persistence/contract.ts';
import { requireInput } from '../persistence/errors.ts';
import type { PersistenceService } from '../persistence/service.ts';
import { buildVisitorUrl } from '../publication/visitor-url.ts';
import { isNonEmptyArray } from '../utilities/array_kit.ts';
import {
  buildCatalogueUrl,
  parseCatalogueNavigation,
} from './catalogue-navigation.ts';

type CatalogueItem = ListResult['items'][number] & {
  visitor_url: string;
};

export interface CataloguePage {
  items: CatalogueItem[];
  firstPageUrl: string;
  newerPostsUrl: string | null;
  olderPostsUrl: string | null;
}

export async function loadCataloguePage(
  service: Pick<PersistenceService, 'listPosts'>,
  pageSize: number,
  origin: string,
  parameters: URLSearchParams,
): Promise<CataloguePage> {
  requireInput(
    Number.isSafeInteger(pageSize) && pageSize > 0,
    'catalogue page size',
  );
  const navigation = parseCatalogueNavigation(parameters);
  const firstPageUrl = buildCatalogueUrl(origin, {
    cursor: null,
    history: [],
  });
  const newerPostsUrl =
    navigation.cursor === null
      ? null
      : buildCatalogueUrl(origin, {
          cursor: navigation.history.at(-1) ?? null,
          history: navigation.history.slice(0, -1),
        });

  const result =
    navigation.cursor === null
      ? await service.listPosts(pageSize)
      : await service.listPosts(pageSize, navigation.cursor);

  let olderPostsUrl: string | null = null;
  if (isNonEmptyArray(result.items) && result.next_cursor !== null) {
    const probe = await service.listPosts(1, result.next_cursor);
    if (isNonEmptyArray(probe.items)) {
      olderPostsUrl = buildCatalogueUrl(origin, {
        cursor: result.next_cursor,
        history:
          navigation.cursor === null
            ? []
            : [...navigation.history, navigation.cursor],
      });
    }
  }

  return {
    items: result.items.map((item) => ({
      ...item,
      visitor_url: buildVisitorUrl(origin, item.post_id),
    })),
    firstPageUrl,
    newerPostsUrl,
    olderPostsUrl,
  };
}
