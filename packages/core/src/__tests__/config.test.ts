import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig } from '../config';

describe('Config Loader', () => {
  const tempRepoDir = path.resolve(process.cwd(), 'temp-test-config-repo');

  before(() => {
    if (!fs.existsSync(tempRepoDir)) {
      fs.mkdirSync(tempRepoDir, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(tempRepoDir)) {
      fs.rmSync(tempRepoDir, { recursive: true, force: true });
    }
  });

  test('loadConfig defaults when config file is missing', () => {
    const config = loadConfig(tempRepoDir);
    assert.deepStrictEqual(config, { roots: ['.'] });
  });

  test('loadConfig parsing and validation of limits', () => {
    const configContent = `
      module.exports = {
        roots: ['packages/core', 'packages/cli'],
        query: { rrfK: 5000 }, // exceeds max limit, should clamp to 1000
        graph: { maxNodes: -100 }, // less than min, should clamp to 1
        watch: { debounceMs: 500, maxFilesPerBatch: 20000 }, // maxFilesPerBatch should clamp to 10000
        memory: { maxAgeDays: 30 }
      };
    `;
    fs.writeFileSync(path.join(tempRepoDir, 'contexthub.config.js'), configContent);

    const config = loadConfig(tempRepoDir);

    assert.deepStrictEqual(config.roots, ['packages/core', 'packages/cli']);
    assert.strictEqual(config.query?.rrfK, 1000);
    assert.strictEqual(config.graph?.maxNodes, 1);
    assert.strictEqual(config.watch?.debounceMs, 500);
    assert.strictEqual(config.watch?.maxFilesPerBatch, 10000);
    assert.strictEqual(config.memory?.maxAgeDays, 30);
  });
});
