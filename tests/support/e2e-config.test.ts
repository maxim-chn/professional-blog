import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadE2eConfig } from './e2e-config.ts';

const E2E_CONFIG = new URL('../config/e2e.json', import.meta.url);

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const settings: Record<string, unknown> = JSON.parse(
    await readFile(E2E_CONFIG, 'utf8'),
  );
  return { directory, file: join(directory, 'e2e.json'), settings };
}

test('resolves paths relative to the selected file and preserves explicit test settings', async (t) => {
  const { directory, file, settings } = await createFixture(t);
  const snapshotDirectory = join(directory, 'retained-snapshots');
  await writeFile(
    file,
    JSON.stringify({
      ...settings,
      runtimeConfig: './runtime.json',
      baselineConfig: './baseline.json',
      outputDirectory: './browser-output',
      snapshotDirectory,
      browser: 'firefox',
      headless: false,
      testTimeoutMs: 25,
      expectTimeoutMs: 10,
      retries: 2,
      trace: 'off',
      screenshot: 'on',
    }),
  );

  const config = await loadE2eConfig(file);
  assert.equal(config.runtimeConfig, join(directory, 'runtime.json'));
  assert.equal(config.baselineConfig, join(directory, 'baseline.json'));
  assert.equal(config.outputDirectory, join(directory, 'browser-output'));
  assert.equal(config.snapshotDirectory, snapshotDirectory);
  assert.equal(config.browser, 'firefox');
  assert.equal(config.headless, false);
  assert.equal(config.testTimeoutMs, 25);
  assert.equal(config.expectTimeoutMs, 10);
  assert.equal(config.retries, 2);
  assert.equal(config.workers, 1);
  assert.equal(config.trace, 'off');
  assert.equal(config.screenshot, 'on');
});

test('rejects missing settings, parallel workers, and invalid configuration values', async (t) => {
  const { file, settings } = await createFixture(t);
  const missingTimeout = { ...settings };
  delete missingTimeout.startupTimeoutMs;
  const missingPath = { ...settings };
  delete missingPath.snapshotDirectory;
  const scenarios = [
    { name: 'missing timeout', value: missingTimeout },
    { name: 'missing snapshot path', value: missingPath },
    { name: 'parallel workers', value: { ...settings, workers: 2 } },
    { name: 'zero timeout', value: { ...settings, startupTimeoutMs: 0 } },
    { name: 'fractional retries', value: { ...settings, retries: 0.5 } },
    { name: 'blank path', value: { ...settings, runtimeConfig: '  ' } },
    { name: 'unsupported browser', value: { ...settings, browser: 'unknown' } },
    {
      name: 'unknown option',
      value: { ...settings, reuseExistingServer: true },
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      await writeFile(file, JSON.stringify(scenario.value));
      await assert.rejects(loadE2eConfig(file), { code: 'INVALID_INPUT' });
    });
  }
  await assert.rejects(loadE2eConfig('relative.json'), {
    code: 'INVALID_INPUT',
  });
});
