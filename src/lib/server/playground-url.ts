import { requireInput } from '../persistence/errors.ts';
import { resolveVisitorOrigin } from '../publication/visitor-url.ts';
import { isNonEmpty } from '../utilities/string_kit.ts';

const PLAYGROUND_PATH_PATTERN = '/playground/{demoAppName}/';
const DEMO_APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function buildPlaygroundUrl(
  origin: string,
  demoAppName: string,
): string {
  requireInput(
    isNonEmpty(demoAppName) && DEMO_APP_NAME_PATTERN.test(demoAppName),
    'Playground application name',
  );
  const path = PLAYGROUND_PATH_PATTERN.replace('{demoAppName}', demoAppName);

  return new URL(path, resolveVisitorOrigin(origin)).href;
}
