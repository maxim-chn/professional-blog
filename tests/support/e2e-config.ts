import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { requireInput } from '../../src/lib/persistence/errors.ts';
import { objectFields } from '../../src/lib/persistence/models/fields.ts';
import { isNonEmpty, isString } from '../../src/lib/utilities/string_kit.ts';

const PATH_FIELDS = [
  'runtimeConfig',
  'isolatedRuntimeConfig',
  'baselineConfig',
  'publicationManifest',
  'outputDirectory',
  'snapshotDirectory',
  'logDirectory',
  'reportDirectory',
] as const;
const POSITIVE_INTEGER_FIELDS = [
  'testTimeoutMs',
  'expectTimeoutMs',
  'startupTimeoutMs',
  'shutdownTimeoutMs',
  'publicationTimeoutMs',
  'paginationFixtureCount',
] as const;
const CONFIG_FIELDS = [
  'description',
  ...PATH_FIELDS,
  ...POSITIVE_INTEGER_FIELDS,
  'browser',
  'headless',
  'workers',
  'retries',
  'trace',
  'screenshot',
];
const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
const TRACE_MODES = ['off', 'on', 'retain-on-failure'] as const;
const SCREENSHOT_MODES = ['off', 'on', 'only-on-failure'] as const;

export type E2eConfig = Record<(typeof PATH_FIELDS)[number], string> &
  Record<(typeof POSITIVE_INTEGER_FIELDS)[number], number> & {
    browser: (typeof BROWSERS)[number];
    headless: boolean;
    workers: 1;
    retries: number;
    trace: (typeof TRACE_MODES)[number];
    screenshot: (typeof SCREENSHOT_MODES)[number];
  };

function configuredChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
  field: string,
): T {
  requireInput(
    isString(value) && choices.some((choice) => choice === value),
    `E2E configuration ${field}`,
  );
  return value as T;
}

export async function loadE2eConfig(file: string): Promise<E2eConfig> {
  requireInput(isAbsolute(file), 'E2E configuration path must be absolute');
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  objectFields(raw, CONFIG_FIELDS, 'E2E configuration fields');
  requireInput(isNonEmpty(raw.description), 'E2E configuration description');

  const paths = Object.fromEntries(
    PATH_FIELDS.map((field) => {
      const value = raw[field];
      requireInput(isNonEmpty(value), `E2E configuration ${field}`);
      return [field, resolve(dirname(file), value)];
    }),
  ) as Record<(typeof PATH_FIELDS)[number], string>;

  const integers = Object.fromEntries(
    POSITIVE_INTEGER_FIELDS.map((field) => {
      const value = raw[field];
      requireInput(
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
        `E2E configuration ${field}`,
      );
      return [field, value];
    }),
  ) as Record<(typeof POSITIVE_INTEGER_FIELDS)[number], number>;

  requireInput(typeof raw.headless === 'boolean', 'E2E headless setting');
  requireInput(raw.workers === 1, 'Shared-root E2E requires one worker');
  requireInput(
    typeof raw.retries === 'number' &&
      Number.isSafeInteger(raw.retries) &&
      raw.retries >= 0,
    'E2E retries must be a non-negative integer',
  );

  return {
    ...paths,
    ...integers,
    browser: configuredChoice(raw.browser, BROWSERS, 'browser'),
    headless: raw.headless,
    workers: raw.workers,
    retries: raw.retries,
    trace: configuredChoice(raw.trace, TRACE_MODES, 'trace'),
    screenshot: configuredChoice(
      raw.screenshot,
      SCREENSHOT_MODES,
      'screenshot',
    ),
  };
}
