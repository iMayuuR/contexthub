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

  test('God-node fixture test with high-degree hubs', async () => {
    const tempDir = path.join(repoPath, 'temp-god-node-test');
    const contexthubDir = path.join(tempDir, '.contexthub');
    fs.mkdirSync(contexthubDir, { recursive: true });

    // Generate ~10,000 nodes and edges
    const nodes: any[] = [];
    const edges: any[] = [];

    // Add 3 hub files
    const hubs = ['src/hub_a.ts', 'src/hub_b.ts', 'src/hub_c.ts'];
    hubs.forEach(h => {
      nodes.push({ id: h, kind: 'file', path: h });
    });

    // Add 3,000 other files and connect them to hubs
    for (let i = 0; i < 3000; i++) {
      const fileId = `src/file_${i}.ts`;
      nodes.push({ id: fileId, kind: 'file', path: fileId });

      if (i < 100) {
        // First 100 files import hub_a
        edges.push({ from: fileId, to: 'src/hub_a.ts', kind: 'imports' });
      } else if (i < 200) {
        // Next 100 files import hub_b
        edges.push({ from: fileId, to: 'src/hub_b.ts', kind: 'imports' });
      } else if (i < 300) {
        // Next 100 files import hub_c
        edges.push({ from: fileId, to: 'src/hub_c.ts', kind: 'imports' });
      }
    }

    const hubGraph: CodeGraph = {
      version: '1.0.0',
      updatedAt: Date.now(),
      nodes,
      edges
    };

    // Save to packages/knowledge-graph/fixtures/hub-graph.json
    const fixturesDir = path.resolve(__dirname, '../../fixtures');
    fs.mkdirSync(fixturesDir, { recursive: true });
    const fixturePath = path.join(fixturesDir, 'hub-graph.json');
    fs.writeFileSync(fixturePath, JSON.stringify(hubGraph, null, 2));

    // Also write to the temp directory's code-graph location
    const tempManager = new CodeGraphManager(tempDir);
    await tempManager.saveGraph(hubGraph);

    const godNodes = await tempManager.getGodNodes(10);
    
    // Assert we get >= 3 hubs returned in the top scored nodes
    const topIds = godNodes.map(n => n.id);
    assert.ok(topIds.includes('src/hub_a.ts'), 'hub_a should be detected');
    assert.ok(topIds.includes('src/hub_b.ts'), 'hub_b should be detected');
    assert.ok(topIds.includes('src/hub_c.ts'), 'hub_c should be detected');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
