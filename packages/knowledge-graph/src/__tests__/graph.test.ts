import { test, describe, before } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { CodeGraphManager } from '../index';
import type { CodeGraph } from '@contexthub/shared-types';

describe('CodeGraphManager', () => {
  const repoPath = path.resolve(process.cwd());
  const graphManager = new CodeGraphManager(repoPath);

  // Mock graph data for testing
  const mockGraph: CodeGraph = {
    version: '1.0.0',
    updatedAt: Date.now(),
    nodes: [
      { id: 'src/a.ts', kind: 'file', path: 'src/a.ts' },
      { id: 'src/b.ts', kind: 'file', path: 'src/b.ts' },
      { id: 'src/c.ts', kind: 'file', path: 'src/c.ts' },
      { id: 'src/d.ts', kind: 'file', path: 'src/d.ts' },
    ],
    edges: [
      { from: 'src/a.ts', to: 'src/b.ts', kind: 'imports' }, // a -> b
      { from: 'src/b.ts', to: 'src/c.ts', kind: 'imports' }, // b -> c
      { from: 'src/c.ts', to: 'src/d.ts', kind: 'imports' }, // c -> d
    ]
  };

  before(async () => {
    // Inject the mock graph by saving it locally
    await graphManager.saveGraph(mockGraph);
  });

  test('getBlastRadius - depth 1', async () => {
    // Who imports 'src/c.ts'? -> 'src/b.ts'
    const { nodes, edges } = await graphManager.getBlastRadius('src/c.ts', 1);
    
    const nodeIds = nodes.map(n => n.id).sort();
    assert.deepStrictEqual(nodeIds, ['src/b.ts']);
    assert.strictEqual(edges.length, 1);
  });

  test('getBlastRadius - depth 2', async () => {
    // Who imports 'src/c.ts' transitively? -> 'src/b.ts', and 'src/a.ts' (who imports b)
    const { nodes, edges } = await graphManager.getBlastRadius('src/c.ts', 2);
    
    const nodeIds = nodes.map(n => n.id).sort();
    assert.deepStrictEqual(nodeIds, ['src/a.ts', 'src/b.ts']);
    assert.strictEqual(edges.length, 2);
  });

  test('tracePath - path exists', async () => {
    const pathIds = await graphManager.tracePath('src/a.ts', 'src/d.ts', 3);
    const expected = [
      { type: 'file', id: 'src/a.ts', label: 'a.ts' },
      { type: 'file', id: 'src/b.ts', label: 'b.ts' },
      { type: 'file', id: 'src/c.ts', label: 'c.ts' },
      { type: 'file', id: 'src/d.ts', label: 'd.ts' }
    ];
    assert.deepStrictEqual(pathIds, expected);
  });

  test('tracePath - path exceeds maxHops', async () => {
    const pathIds = await graphManager.tracePath('src/a.ts', 'src/d.ts', 2);
    assert.deepStrictEqual(pathIds, null);
  });

  test('tracePath - no path exists', async () => {
    const pathIds = await graphManager.tracePath('src/d.ts', 'src/a.ts', 5);
    // Directed graph, d doesn't import a
    assert.deepStrictEqual(pathIds, null);
  });
});
