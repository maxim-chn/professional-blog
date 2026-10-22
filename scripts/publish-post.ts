import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  PersistenceError,
  requireInput,
} from '../src/lib/persistence/errors.ts';
import { loadPublicationConfig } from '../src/lib/publication/config.ts';
import { publishManifest } from '../src/lib/publication/publish.ts';
import { isNonEmpty } from '../src/lib/utilities/string_kit.ts';

const CLI_OPTIONS = {
  config: { type: 'string' },
  manifest: { type: 'string' },
  root: { type: 'string' },
  help: { type: 'boolean' },
} as const;

const HELP_TEXT = [
  'Usage: node scripts/publish-post.ts --config <file> --manifest <file> [--root <directory>]',
  '',
  '--config    Required publication configuration JSON file.',
  '--manifest  Required saved publication manifest JSON file.',
  '--root      Explicit override of the configured persistence root.',
  '--help      Print this help without publishing.',
  '',
  'Command-line paths resolve relative to the current working directory.',
  'Paths inside configuration and manifest files resolve relative to those files.',
  'Created and identical duplicate results exit successfully.',
  'The returned visitor URL does not imply that a server is running.',
].join('\n');

function readArguments(args: string[]) {
  try {
    return parseArgs({
      args,
      options: CLI_OPTIONS,
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (cause) {
    throw new PersistenceError('INVALID_INPUT', 'publication arguments', {
      cause,
    });
  }
}

async function main(args: string[]): Promise<void> {
  const values = readArguments(args);
  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  requireInput(isNonEmpty(values.config), '--config is required');
  requireInput(isNonEmpty(values.manifest), '--manifest is required');
  if (values.root !== undefined) {
    requireInput(isNonEmpty(values.root), '--root must be nonblank');
  }

  const config = await loadPublicationConfig(resolve(values.config));
  const root = values.root === undefined ? undefined : resolve(values.root);
  const result = await publishManifest(
    resolve(values.manifest),
    config,
    () => new Date(),
    root,
  );
  console.log(JSON.stringify(result));
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(
    JSON.stringify({
      code: error instanceof PersistenceError ? error.code : 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : String(error),
      cause:
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : undefined,
      cleanupFailures:
        error instanceof PersistenceError ? error.cleanupFailures : undefined,
    }),
  );
  process.exitCode = 1;
}
