import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { ContextHubCore } from '@imayuur/contexthub-core';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { GitIntegration } from '@imayuur/contexthub-git-integration';
import { buildContextBundle } from '@imayuur/contexthub-mcp-server';

test('get_context_bundle Latency Integration Test', async (t) => {
  const repoPath = path.resolve(__dirname, '../../../../'); // root of workspace

  await t.test('buildContextBundle completes in < 500ms (or < 1500ms on slower CI runners)', async () => {
    const core = new ContextHubCore(repoPath);
    await core.initStorage();

    const vectorEngine = new VectorEngine(repoPath);
    const graphManager = new CodeGraphManager(repoPath);
    const gitIntegration = new GitIntegration(core, repoPath);

    // Run first to warm up any lazy loads
    await buildContextBundle(
      { query: 'test', path: 'packages/cli/src/index.ts', repoPath },
      core,
      vectorEngine,
      graphManager,
      gitIntegration
    );

    const t0 = Date.now();
    const bundle = await buildContextBundle(
      { query: 'test', path: 'packages/cli/src/index.ts', repoPath },
      core,
      vectorEngine,
      graphManager,
      gitIntegration
    );
    const duration = Date.now() - t0;

    console.log(`\n[LATENCY] buildContextBundle completed in: ${duration}ms`);

    assert.ok(bundle, 'Should return a valid context bundle');
    assert.strictEqual(bundle.truncated, false, 'Bundle should not be truncated');
    
    // Assert generous latency bounds for virtualized runner stability
    const maxAllowedMs = process.env.CI ? 1500 : 500;
    assert.ok(
      duration < maxAllowedMs,
      `buildContextBundle latency must be < ${maxAllowedMs}ms (got ${duration}ms)`
    );

    await core.close();
  });
});
