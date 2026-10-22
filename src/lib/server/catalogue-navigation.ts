import { requireInput } from '../persistence/errors.ts';
import { utcTimestamp } from '../persistence/models/fields.ts';
import { resolveVisitorOrigin } from '../publication/visitor-url.ts';
import { isNonEmptyArray } from '../utilities/array_kit.ts';

export const CATALOGUE_PATH = '/blog-post-catalogue/';
const NEXT_PAGE_PARAMETER = 'next_page';
const PREVIOUS_PAGE_PARAMETER = 'prev_page';

export interface CatalogueNavigation {
  cursor: string | null;
  history: string[];
}

function checkNavigation(navigation: CatalogueNavigation): void {
  const { cursor, history } = navigation;
  requireInput(
    cursor !== null || !isNonEmptyArray(history),
    'catalogue history requires next_page',
  );
  const cursors = cursor === null ? history : [...history, cursor];
  let previous: string | undefined;
  for (const value of cursors) {
    utcTimestamp(value, 'catalogue cursor', true);
    requireInput(
      previous === undefined || previous > value,
      'catalogue cursor history must be strictly descending',
    );
    previous = value;
  }
}

export function parseCatalogueNavigation(
  parameters: URLSearchParams,
): CatalogueNavigation {
  const current = parameters.getAll(NEXT_PAGE_PARAMETER);
  requireInput(current.length <= 1, 'multiple catalogue next_page values');
  const navigation = {
    cursor: current[0] ?? null,
    history: parameters.getAll(PREVIOUS_PAGE_PARAMETER),
  };
  checkNavigation(navigation);
  return navigation;
}

export function buildCatalogueUrl(
  origin: string,
  navigation: CatalogueNavigation,
): string {
  checkNavigation(navigation);
  const url = new URL(CATALOGUE_PATH, resolveVisitorOrigin(origin));
  if (navigation.cursor !== null) {
    url.searchParams.set(NEXT_PAGE_PARAMETER, navigation.cursor);
  }
  for (const cursor of navigation.history) {
    url.searchParams.append(PREVIOUS_PAGE_PARAMETER, cursor);
  }
  return url.href;
}
