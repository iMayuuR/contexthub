import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ContextHubCore } from '../index';
import { runUnifiedQuery } from '../query-pipeline';

test('RRF Hybrid Query Pipeline Test', async (t) => {
  const tempDir = path.resolve(__dirname, '../../../../temp-pipeline-test');
  const contexthubDir = path.join(tempDir, '.contexthub');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(contexthubDir, { recursive: true });

  const keyfile = path.join(contexthubDir, '.keyfile');
  fs.writeFileSync(keyfile, crypto.randomBytes(32).toString('hex'));

  const core = new ContextHubCore(tempDir);
  await core.initStorage();

  const sessionId = await core.createSession('pipeline-test', { source: 'unit-test' });

  // Memory A: Keyword-only match
  const idA = await core.saveMemory({
    sessionId,
    type: 'decision',
    content: 'Contains keyword xyzzy but is completely irrelevant to the actual question.',
    timestamp: Date.now(),
    tags: ['irrelevant']
  });

  // Memory B: Target semantic + graph match (no direct keyword match)
  const idB = await core.saveMemory({
    sessionId,
    type: 'architecture',
    content: 'This details the actual database architecture solution for cross-device syncing.',
    timestamp: Date.now(),
    tags: ['architecture', 'sync'],
    relatedPaths: ['src/helper.ts']
  });

  await core.endSession(sessionId);

  t.after(async () => {
    await core.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('RRF ranks target (Memory B) higher than naive keyword-only match (Memory A)', async () => {
    // Mock VectorEngine to return Memory B as high semantic match
    const mockVectorEngine = {
      searchSimilarText: async (query: string, memories: any[], limit: number) => {
        // Return Memory B at rank 0, and Memory A at rank 1
        const memB = memories.find(m => m.id === idB);
        const memA = memories.find(m => m.id === idA);
        return [
          { id: idB, content: memB.content, similarity: 0.95 },
          { id: idA, content: memA.content, similarity: 0.45 }
        ];
      }
    };

    // Mock CodeGraphManager to find helper.ts as direct mention (graph pseudo-hit)
    const mockGraphManager = {
      loadGraph: async () => ({
        nodes: [
          { id: 'src/helper.ts', kind: 'file', path: 'src/helper.ts' }
        ],
        edges: []
      }),
      getRelatedSymbols: async (id: string, limit: number) => []
    };

    // Query "xyzzy architecture helper.ts"
    const results = await runUnifiedQuery(
      'xyzzy architecture helper.ts',
      10,
      core,
      mockVectorEngine,
      mockGraphManager,
      null
    );

    // Naive keyword match only scores Memory A (contains "xyzzy")
    // RRF ranks Memory B higher because it hits both Semantic Rank 0 and Graph Pseudo-Hits.
    assert.ok(results.memories.length >= 2, 'Should return both memories');
    
    const firstMemory = results.memories[0];
    assert.strictEqual(firstMemory.id, idB, 'Target Memory B must be ranked #1 via RRF');
    assert.strictEqual(results.memories[1].id, idA, 'Keyword-only Memory A must be ranked #2');
  });
});
