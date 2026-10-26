import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';
import type { CatalogueEntry } from '../../src/lib/persistence/service.ts';
import { loadBaselineConfig } from '../support/baseline-config.ts';
import { loadE2eConfig } from '../support/e2e-config.ts';
import { acquireE2eLock } from '../support/e2e-lock.ts';
import { loadE2eRuntime } from '../support/e2e-runtime.ts';
import { captureGitBaseline } from '../support/git-baseline.ts';
import {
  readStorageTree,
  type StorageSnapshot,
  type StorageTree,
} from '../support/storage-snapshot.ts';

const PROJECT_DIRECTORY = fileURLToPath(new URL('../../', import.meta.url));
const CONFIG_FILE = join(PROJECT_DIRECTORY, 'tests/config/e2e.json');
const FAILURE_MESSAGE = 'Intentional browser failure after publication';

function collectTests(suites: JSONReportSuite[]): JSONReportSuite['specs'] {
  return suites.flatMap((suite) => [
    ...suite.specs,
    ...collectTests(suite.suites ?? []),
  ]);
}

test('a failed browser run restores baseline and protected storage', async () => {
  const settings = await loadE2eConfig(CONFIG_FILE);
  const runtime = await loadE2eRuntime(settings.runtimeConfig);
  const posts = await loadBaselineConfig(settings.baselineConfig);
  const before = await readStorageTree(runtime.persistence.root);
  const baseline = await captureGitBaseline(
    runtime.persistence.root,
    posts.flatMap((post) => post.paths),
  );
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: '0',
  };
  delete environment.PLAYWRIGHT_JSON_OUTPUT_FILE;
  delete environment.PLAYWRIGHT_JSON_OUTPUT_DIR;
  delete environment.PLAYWRIGHT_JSON_OUTPUT_NAME;
  const child = spawn(
    process.execPath,
    [
      join(PROJECT_DIRECTORY, 'node_modules/playwright/cli.js'),
      'test',
      '--config',
      join(PROJECT_DIRECTORY, 'playwright.failure.config.ts'),
    ],
    {
      cwd: PROJECT_DIRECTORY,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const [code, signal] = await once(child, 'close');
  assert.equal(signal, null, stderr);
  assert.equal(code, 1, stdout + stderr);
  const report: JSONReport = JSON.parse(stdout);
  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.unexpected, 1);
  assert.equal(report.stats.expected, 0);
  assert.equal(report.stats.skipped, 0);
  assert.equal(report.stats.flaky, 0);
  const specs = collectTests(report.suites);
  assert.equal(specs.length, 1);
  assert.equal(specs[0].tests.length, 1);
  const scenario = specs[0].tests[0];
  assert.equal(scenario.status, 'unexpected');
  assert.equal(scenario.results.length, 1);
  const result = scenario.results[0];
  assert.equal(result.status, 'failed');
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].message.includes(FAILURE_MESSAGE));
  const attachment = result.attachments.find(
    (item) => item.name === 'recovery-directory',
  );
  assert.ok(attachment);
  assert.ok(attachment.path || attachment.body);
  const recoveryDirectory = attachment.path
    ? await readFile(attachment.path, 'utf8')
    : Buffer.from(attachment.body!, 'base64').toString('utf8');
  const initial: StorageSnapshot = JSON.parse(
    await readFile(join(recoveryDirectory, 'initial-snapshot.json'), 'utf8'),
  );
  const prepared: StorageSnapshot = JSON.parse(
    await readFile(join(recoveryDirectory, 'prepared-snapshot.json'), 'utf8'),
  );
  assert.equal(initial.root, baseline.root);
  assert.equal(prepared.root, baseline.root);
  assert.deepEqual(
    { directories: initial.directories, files: initial.files },
    before,
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(join(recoveryDirectory, 'baseline.json'), 'utf8'),
    ),
    baseline,
  );
  const after = await readStorageTree(runtime.persistence.root);
  assert.deepEqual(after, {
    directories: prepared.directories,
    files: prepared.files,
  });
  const baselinePaths = new Set(
    baseline.files.map((file) => file.relativePath),
  );
  for (const file of baseline.files) {
    assert.deepEqual(
      after.files.find(
        (candidate) => candidate.relativePath === file.relativePath,
      ),
      file,
    );
  }
  const protectedFiles = (tree: StorageTree) =>
    tree.files.filter(
      (file) =>
        !baselinePaths.has(file.relativePath) &&
        file.relativePath !== 'catalogue.json',
    );
  assert.deepEqual(protectedFiles(after), protectedFiles(before));
  const baselineIds = new Set(posts.map((post) => post.postId));
  const authorCatalogue = (tree: StorageTree) => {
    const file = tree.files.find(
      (item) => item.relativePath === 'catalogue.json',
    );
    const entries: CatalogueEntry[] = file
      ? JSON.parse(Buffer.from(file.base64, 'base64').toString('utf8'))
      : [];
    return entries.filter((entry) => !baselineIds.has(entry.registry.post_id));
  };
  assert.deepEqual(authorCatalogue(after), authorCatalogue(before));
  const release = await acquireE2eLock(
    runtime.persistence.root,
    settings.snapshotDirectory,
  );
  await release();
});
