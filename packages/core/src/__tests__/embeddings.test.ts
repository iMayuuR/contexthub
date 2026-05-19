import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { VectorEngine } from '@contexthub/vector-engine';
import type { MemoryEntry } from '@contexthub/shared-types';

test('Local Offline Bigram TF-IDF Embeddings Test', async (t) => {
  const tempDir = path.resolve(__dirname, '../../../../temp-embeddings-smoke-repo');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(tempDir, '.contexthub'), { recursive: true });

  t.after(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('searchSimilarText returns expected top hit on seeded memories with zero API keys', async () => {
    const ve = new VectorEngine(tempDir, 'local');

    // Create 7 diverse memories
    const memories: MemoryEntry[] = [
      {
        id: 'mem-1',
        sessionId: 'session-1',
        type: 'decision',
        content: 'Database indexing strategies and cross-device grocery replication policies.',
        timestamp: Date.now(),
        tags: ['db', 'sync']
      },
      {
        id: 'mem-2',
        sessionId: 'session-1',
        type: 'architecture',
        content: 'High fidelity user interface styling, glassmorphism, responsive colors, and premium css tokens.',
        timestamp: Date.now(),
        tags: ['ui', 'css']
      },
      {
        id: 'mem-3',
        sessionId: 'session-1',
        type: 'bugfix',
        content: 'Fixing memory leak inside node stdio transport buffer allocation.',
        timestamp: Date.now(),
        tags: ['bug', 'node']
      },
      {
        id: 'mem-4',
        sessionId: 'session-1',
        type: 'manual',
        content: 'Python language parser implementation guidelines using AST parsing techniques.',
        timestamp: Date.now(),
        tags: ['python', 'parser']
      },
      {
        id: 'mem-5',
        sessionId: 'session-1',
        type: 'decision',
        content: 'HMAC authentication tokens, encryption keyfile storage, and permission bit checking.',
        timestamp: Date.now(),
        tags: ['security', 'auth']
      }
    ];

    // Query 1: UI / CSS styling
    const resultsUI = await ve.searchSimilarText('responsive CSS layout and UI styling colors', memories, 3);
    assert.ok(resultsUI.length > 0);
    assert.strictEqual(resultsUI[0].id, 'mem-2', 'Top hit should be the UI architecture memory');

    // Query 2: DB indexing / Grocery sync
    const resultsDB = await ve.searchSimilarText('database index grocery replication policies', memories, 3);
    assert.ok(resultsDB.length > 0);
    assert.strictEqual(resultsDB[0].id, 'mem-1', 'Top hit should be the database index memory');

    // Query 3: Security / HMAC auth
    const resultsSec = await ve.searchSimilarText('secure HMAC keys and encryption storage permissions', memories, 3);
    assert.ok(resultsSec.length > 0);
    assert.strictEqual(resultsSec[0].id, 'mem-5', 'Top hit should be the security memory');
  });
});
