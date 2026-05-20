import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { RepoParser } from '@imayuur/contexthub-repo-parser';
import { SecurityManager, DEFAULT_QUERY_LIMIT, loadConfig } from '@imayuur/contexthub-core';
import type { CodeGraph, CodeGraphNode, CodeGraphEdge, ParsedFile, GraphDiff } from '@imayuur/contexthub-shared-types';

export class CodeGraphManager {
  private repoPath: string;
  private contexthubPath: string;
  private graphDirPath: string;
  private graphPath: string;
  private metaPath: string;
  private snapshotDirPath: string;
  private parser: RepoParser;
  private security: SecurityManager;

  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath);
    this.contexthubPath = path.join(this.repoPath, '.contexthub');
    this.graphDirPath = path.join(this.contexthubPath, 'graph');
    this.graphPath = path.join(this.graphDirPath, 'code-graph.json');
    this.metaPath = path.join(this.graphDirPath, 'index-meta.json');
    this.snapshotDirPath = path.join(this.graphDirPath, 'snapshots');
    this.parser = new RepoParser(this.repoPath);
    this.security = new SecurityManager(this.repoPath);

    // Ensure directory exists with secure permissions
    if (!fs.existsSync(this.graphDirPath)) {
      fs.mkdirSync(this.graphDirPath, { recursive: true });
      this.security.setSecurePermissions(this.graphDirPath, true);
    }
    if (!fs.existsSync(this.snapshotDirPath)) {
      fs.mkdirSync(this.snapshotDirPath, { recursive: true });
      this.security.setSecurePermissions(this.snapshotDirPath, true);
    }
  }

  /**
   * Helper to compute prefixed node ID and repository-relative path based on monorepo roots.
   */
  getNodeIdAndRelPath(filePath: string, roots: string[]): { id: string; relPath: string } {
    const absPath = path.resolve(this.repoPath, filePath);
    
    // Find the best matching root
    let bestRoot = '.';
    let bestRootLen = -1;
    for (const r of roots) {
      const absRoot = path.resolve(this.repoPath, r);
      if (absPath.startsWith(absRoot + path.sep) || absPath === absRoot) {
        if (r.length > bestRootLen) {
          bestRoot = r;
          bestRootLen = r.length;
        }
      }
    }
    
    const absRootPath = path.resolve(this.repoPath, bestRoot);
    const relToRoot = path.relative(absRootPath, absPath).replace(/\\/g, '/');
    const relToRepo = path.relative(this.repoPath, absPath).replace(/\\/g, '/');
    
    if (bestRoot === '.') {
      return { id: relToRepo, relPath: relToRepo };
    } else {
      const prefix = `pkg:${path.basename(bestRoot)}`;
      return { id: `${prefix}#${relToRoot}`, relPath: relToRepo };
    }
  }

  // ─── Core Graph Operations ────────────────────────────────────────────────

  /**
   * Build a completely fresh code graph of the repository.
   */
  async buildCodeGraph(): Promise<CodeGraph> {
    const config = loadConfig(this.repoPath);
    const roots = config.roots || ['.'];
    
    const parsedFiles: ParsedFile[] = [];
    for (const r of roots) {
      const rootDir = path.resolve(this.repoPath, r);
      if (fs.existsSync(rootDir)) {
        const pf = await this.parser.parseDirectory(rootDir);
        parsedFiles.push(...pf);
      }
    }

    // Deduplicate by path
    const uniqueFiles = new Map<string, ParsedFile>();
    for (const pf of parsedFiles) {
      uniqueFiles.set(pf.path, pf);
    }
    const deduplicatedParsedFiles = Array.from(uniqueFiles.values());

    const graph: CodeGraph = {
      version: '1.0.0',
      updatedAt: Date.now(),
      nodes: [],
      edges: []
    };

    // Helper maps
    const parsedFilesMap = new Map<string, ParsedFile>();
    const symbolNodesMap = new Map<string, CodeGraphNode>();

    // 1. Create all nodes (files and symbols)
    for (const pf of deduplicatedParsedFiles) {
      const { id: fileNodeId, relPath } = this.getNodeIdAndRelPath(pf.path, roots);
      parsedFilesMap.set(relPath, pf);

      // File node
      graph.nodes.push({
        id: fileNodeId,
        kind: 'file',
        path: relPath,
        lang: pf.language
      });

      // Symbol nodes
      for (const sym of pf.symbols) {
        const symId = `${fileNodeId}#${sym.name}`;
        const symNode: CodeGraphNode = {
          id: symId,
          kind: 'symbol',
          path: relPath,
          name: sym.name
        };
        graph.nodes.push(symNode);
        symbolNodesMap.set(symId, symNode);

        // Contains edge
        graph.edges.push({
          from: fileNodeId,
          to: symId,
          kind: 'contains'
        });
      }
    }

    // 2. Resolve imports and build import edges
    const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
    
    for (const pf of deduplicatedParsedFiles) {
      const { id: fileNodeId, relPath } = this.getNodeIdAndRelPath(pf.path, roots);

      for (const imp of pf.imports) {
        if (imp.source.startsWith('.') || imp.source.startsWith('/')) {
          // Resolve relative or absolute path within repo
          const absoluteImportPath = path.resolve(path.dirname(pf.path), imp.source);
          let targetRelPath: string | null = null;

          for (const ext of possibleExtensions) {
            const fullPath = absoluteImportPath + ext;
            const rel = path.relative(this.repoPath, fullPath).replace(/\\/g, '/');
            if (parsedFilesMap.has(rel)) {
              targetRelPath = rel;
              break;
            }
          }

          if (targetRelPath) {
            const targetAbsPath = path.resolve(this.repoPath, targetRelPath);
            const { id: targetFileNodeId } = this.getNodeIdAndRelPath(targetAbsPath, roots);
            
            // Add file-to-file import edge
            graph.edges.push({
              from: fileNodeId,
              to: targetFileNodeId,
              kind: 'imports'
            });

            // Add symbol import edges if specified
            for (const name of imp.imported) {
              const symId = `${targetFileNodeId}#${name}`;
              if (symbolNodesMap.has(symId)) {
                graph.edges.push({
                  from: fileNodeId,
                  to: symId,
                  kind: 'imports'
                });
              }
            }
          }
        }
      }
    }

    // 3. Simple calls edge extraction (best-effort)
    // For each file, search for usages of other files' symbols
    for (const pf of deduplicatedParsedFiles) {
      const { id: fileNodeId, relPath } = this.getNodeIdAndRelPath(pf.path, roots);
      let content = '';
      try {
        content = fs.readFileSync(pf.path, 'utf8');
      } catch {
        continue;
      }

      for (const targetNode of graph.nodes) {
        if (targetNode.kind === 'symbol' && targetNode.path !== relPath && targetNode.name) {
          // Check if symbol name is called/referenced in the file content
          // Using a word boundary RegExp to avoid false partial matches
          const regex = new RegExp('\\b' + targetNode.name + '\\b');
          if (regex.test(content)) {
            graph.edges.push({
              from: fileNodeId,
              to: targetNode.id,
              kind: 'calls'
            });
          }
        }
      }
    }

    await this.saveGraph(graph);
    return graph;
  }

  /**
   * Incrementally update the graph for a list of changed files.
   */
  async patchCodeGraph(changedPaths: string[]): Promise<CodeGraph> {
    let graph: CodeGraph;
    try {
      graph = await this.loadGraph();
    } catch {
      return this.buildCodeGraph();
    }

    const config = loadConfig(this.repoPath);
    const roots = config.roots || ['.'];

    const absChangedPaths = changedPaths.map(p => path.resolve(this.repoPath, p));

    // 1. Remove old nodes and edges for modified files
    for (const absPath of absChangedPaths) {
      const { id: fileNodeId, relPath } = this.getNodeIdAndRelPath(absPath, roots);
      
      // Filter out nodes
      graph.nodes = graph.nodes.filter(n => n.path !== relPath);

      // Filter out edges
      graph.edges = graph.edges.filter(e => {
        const isFromFile = e.from === fileNodeId || e.from.startsWith(fileNodeId + '#');
        const isToFile = e.to === fileNodeId || e.to.startsWith(fileNodeId + '#');
        return !isFromFile && !isToFile;
      });
    }

    // 2. Re-parse and insert updated files
    const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
    const updatedFiles: ParsedFile[] = [];

    for (const absPath of absChangedPaths) {
      if (fs.existsSync(absPath)) {
        const pf = await this.parser.parseFile(absPath);
        updatedFiles.push(pf);
      }
    }

    const symbolNodesMap = new Map<string, CodeGraphNode>();
    for (const node of graph.nodes) {
      if (node.kind === 'symbol') {
        symbolNodesMap.set(node.id, node);
      }
    }

    // Track active parsed files mapping for resolving imports
    const parsedFilesMap = new Map<string, ParsedFile>();
    // First, seed with existing nodes in graph
    for (const node of graph.nodes) {
      if (node.kind === 'file') {
        parsedFilesMap.set(node.path, {
          path: path.resolve(this.repoPath, node.path),
          language: node.lang || 'unknown',
          symbols: [],
          imports: [],
          exports: []
        });
      }
    }
    // Update with new files
    for (const pf of updatedFiles) {
      const { id: fileNodeId, relPath } = this.getNodeIdAndRelPath(pf.path, roots);
      parsedFilesMap.set(relPath, pf);

      // Add file node
      graph.nodes.push({
        id: fileNodeId,
        kind: 'file',
        path: relPath,
        lang: pf.language
      });

      // Add symbols
      for (const sym of pf.symbols) {
        const symId = `${fileNodeId}#${sym.name}`;
        const symNode: CodeGraphNode = {
          id: symId,
          kind: 'symbol',
          path: relPath,
          name: sym.name
        };
        graph.nodes.push(symNode);
        symbolNodesMap.set(symId, symNode);

        // Contains edge
        graph.edges.push({
          from: fileNodeId,
          to: symId,
          kind: 'contains'
        });
      }
    }

    // Resolve imports for updated files
    for (const pf of updatedFiles) {
      const { id: fileNodeId, relPath } = this.getNodeIdAndRelPath(pf.path, roots);

      for (const imp of pf.imports) {
        if (imp.source.startsWith('.') || imp.source.startsWith('/')) {
          const absoluteImportPath = path.resolve(path.dirname(pf.path), imp.source);
          let targetRelPath: string | null = null;

          for (const ext of possibleExtensions) {
            const fullPath = absoluteImportPath + ext;
            const rel = path.relative(this.repoPath, fullPath).replace(/\\/g, '/');
            if (parsedFilesMap.has(rel)) {
              targetRelPath = rel;
              break;
            }
          }

          if (targetRelPath) {
            const targetAbsPath = path.resolve(this.repoPath, targetRelPath);
            const { id: targetFileNodeId } = this.getNodeIdAndRelPath(targetAbsPath, roots);

            graph.edges.push({
              from: fileNodeId,
              to: targetFileNodeId,
              kind: 'imports'
            });

            for (const name of imp.imported) {
              const symId = `${targetFileNodeId}#${name}`;
              if (symbolNodesMap.has(symId)) {
                graph.edges.push({
                  from: fileNodeId,
                  to: symId,
                  kind: 'imports'
                });
              }
            }
          }
        }
      }
    }

    // Add calls from updated files to all symbols
    for (const pf of updatedFiles) {
      const { id: fileNodeId, relPath } = this.getNodeIdAndRelPath(pf.path, roots);
      let content = '';
      try {
        content = fs.readFileSync(pf.path, 'utf8');
      } catch {
        continue;
      }

      for (const targetNode of graph.nodes) {
        if (targetNode.kind === 'symbol' && targetNode.path !== relPath && targetNode.name) {
          const regex = new RegExp('\\b' + targetNode.name + '\\b');
          if (regex.test(content)) {
            graph.edges.push({
              from: fileNodeId,
              to: targetNode.id,
              kind: 'calls'
            });
          }
        }
      }
    }

    // Also, search all other files for calls to newly added symbols in updated files
    for (const pf of updatedFiles) {
      const { id: fileNodeId, relPath } = this.getNodeIdAndRelPath(pf.path, roots);
      for (const sym of pf.symbols) {
        const symId = `${fileNodeId}#${sym.name}`;

        // Scan other files on disk for calls to this new symbol
        for (const node of graph.nodes) {
          if (node.kind === 'file' && node.path !== relPath) {
            try {
              const otherAbsPath = path.resolve(this.repoPath, node.path);
              const otherContent = fs.readFileSync(otherAbsPath, 'utf8');
              const regex = new RegExp('\\b' + sym.name + '\\b');
              if (regex.test(otherContent)) {
                graph.edges.push({
                  from: node.id,
                  to: symId,
                  kind: 'calls'
                });
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    }

    graph.updatedAt = Date.now();
    await this.saveGraph(graph);
    return graph;
  }

  // ─── Query Helpers ────────────────────────────────────────────────────────

  /**
   * Get related symbols based on a file path or symbol ID.
   */
  async getRelatedSymbols(fileOrSymbol: string, limit: number = DEFAULT_QUERY_LIMIT): Promise<CodeGraphNode[]> {
    const graph = await this.loadGraph();
    const related = new Set<CodeGraphNode>();

    // Check if target is a node
    const targetNode = graph.nodes.find(n => n.id === fileOrSymbol || n.path === fileOrSymbol);
    if (!targetNode) return [];

    // Find all directly connected nodes (incoming or outgoing edges)
    for (const edge of graph.edges) {
      if (edge.from === targetNode.id) {
        const match = graph.nodes.find(n => n.id === edge.to && n.kind === 'symbol');
        if (match) related.add(match);
      }
      if (edge.to === targetNode.id) {
        const match = graph.nodes.find(n => n.id === edge.from && n.kind === 'symbol');
        if (match) related.add(match);
      }
    }

    // If it's a file, add its own contained symbols
    if (targetNode.kind === 'file') {
      const contained = graph.nodes.filter(n => n.path === targetNode.path && n.kind === 'symbol');
      for (const c of contained) related.add(c);
    }

    return Array.from(related).slice(0, limit);
  }

  /**
   * Get the transitive blast radius of a file or symbol.
   * Traverses backward (incoming edges: who imports or calls this node).
   */
  async getBlastRadius(fileOrSymbol: string, depth: number = 2): Promise<{ nodes: CodeGraphNode[]; edges: CodeGraphEdge[] }> {
    const graph = await this.loadGraph();
    const visited = new Set<string>();
    const resultNodes: CodeGraphNode[] = [];
    const resultEdges: CodeGraphEdge[] = [];

    // Resolve target node(s)
    let startIds = graph.nodes.filter(n => n.id === fileOrSymbol || n.path === fileOrSymbol).map(n => n.id);
    if (startIds.length === 0) return { nodes: [], edges: [] };

    let currentQueue = [...startIds];
    visited.add(fileOrSymbol);

    for (let d = 0; d < depth; d++) {
      const nextQueue: string[] = [];
      for (const currentId of currentQueue) {
        // Find edges pointing *to* currentId (importers/callers)
        const incomingEdges = graph.edges.filter(e => e.to === currentId);
        for (const edge of incomingEdges) {
          if (!visited.has(edge.from)) {
            visited.add(edge.from);
            nextQueue.push(edge.from);

            const node = graph.nodes.find(n => n.id === edge.from);
            if (node) {
              resultNodes.push(node);
              resultEdges.push(edge);
            }
          }
        }
      }
      if (nextQueue.length === 0) break;
      currentQueue = nextQueue;
    }

    return { nodes: resultNodes, edges: resultEdges };
  }

  /**
   * Trace the shortest path from node A to node B using BFS.
   */
  async tracePath(fromId: string, toId: string, maxHops: number = 5): Promise<Array<{ type: string; id: string; label: string }> | null> {
    const graph = await this.loadGraph();

    // Map graph to adjacency list
    const adj = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (!adj.has(edge.from)) adj.set(edge.from, []);
      adj.get(edge.from)!.push(edge.to);
    }

    // BFS setup
    const queue: string[][] = [[fromId]];
    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const pathArr = queue.shift()!;
      const curr = pathArr[pathArr.length - 1];

      if (curr === toId) {
        // Construct detailed trace output
        return pathArr.map(id => {
          const node = graph.nodes.find(n => n.id === id);
          return {
            type: node?.kind || 'unknown',
            id,
            label: node?.name || path.basename(id)
          };
        });
      }

      if (pathArr.length - 1 >= maxHops) continue;

      const neighbors = adj.get(curr) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...pathArr, neighbor]);
        }
      }
    }

    return null;
  }

  // ─── God-nodes & Communities ────────────────────────────────────────────────

  /**
   * Get "god-nodes" — files with the highest total degree (in + out edges).
   * These are the most interconnected files in the codebase.
   */
  async getGodNodes(limit: number = DEFAULT_QUERY_LIMIT): Promise<Array<{ id: string; path: string; degree: number; inDegree: number; outDegree: number }>> {
    const graph = await this.loadGraph();

    // Count in-degree and out-degree for file nodes only
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    for (const node of graph.nodes) {
      if (node.kind === 'file') {
        inDegree.set(node.id, 0);
        outDegree.set(node.id, 0);
      }
    }

    for (const edge of graph.edges) {
      // Only count edges between file nodes (imports), skip contains edges
      if (edge.kind === 'contains') continue;

      // Resolve to file-level: if edge.from is a symbol, use its file path
      const fromNode = graph.nodes.find(n => n.id === edge.from);
      const toNode = graph.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const fromFile = fromNode.kind === 'file' ? fromNode.id : fromNode.path;
      const toFile = toNode.kind === 'file' ? toNode.id : toNode.path;

      if (fromFile && toFile && fromFile !== toFile) {
        outDegree.set(fromFile, (outDegree.get(fromFile) || 0) + 1);
        inDegree.set(toFile, (inDegree.get(toFile) || 0) + 1);
      }
    }

    // Compute total degree and sort
    const scored = graph.nodes
      .filter(n => n.kind === 'file')
      .map(n => ({
        id: n.id,
        path: n.path || n.id,
        inDegree: inDegree.get(n.id) || 0,
        outDegree: outDegree.get(n.id) || 0,
        degree: (inDegree.get(n.id) || 0) + (outDegree.get(n.id) || 0)
      }))
      .filter(n => n.degree > 0)
      .sort((a, b) => b.degree - a.degree);

    return scored.slice(0, limit);
  }

  /**
   * Detect communities using connected components on file-level nodes.
   * Returns groups of files that are transitively connected via imports.
   * Capped at 50 communities max.
   */
  async detectCommunities(): Promise<Array<{ id: number; files: string[]; size: number }>> {
    const graph = await this.loadGraph();
    const MAX_COMMUNITIES = 50;

    // Build undirected adjacency list for file nodes only
    const fileNodes = new Set<string>();
    for (const node of graph.nodes) {
      if (node.kind === 'file') fileNodes.add(node.id);
    }

    const adj = new Map<string, Set<string>>();
    for (const fileId of fileNodes) {
      adj.set(fileId, new Set());
    }

    for (const edge of graph.edges) {
      if (edge.kind === 'contains') continue;

      const fromNode = graph.nodes.find(n => n.id === edge.from);
      const toNode = graph.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const fromFile = fromNode.kind === 'file' ? fromNode.id : fromNode.path;
      const toFile = toNode.kind === 'file' ? toNode.id : toNode.path;

      if (fromFile && toFile && fileNodes.has(fromFile) && fileNodes.has(toFile) && fromFile !== toFile) {
        adj.get(fromFile)!.add(toFile);
        adj.get(toFile)!.add(fromFile);
      }
    }

    // BFS to find connected components
    const visited = new Set<string>();
    const communities: Array<{ id: number; files: string[]; size: number }> = [];
    let communityId = 0;

    for (const fileId of fileNodes) {
      if (visited.has(fileId)) continue;
      if (communities.length >= MAX_COMMUNITIES) break;

      const component: string[] = [];
      const queue = [fileId];
      visited.add(fileId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);

        for (const neighbor of (adj.get(current) || [])) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      communities.push({
        id: communityId++,
        files: component.sort(),
        size: component.length
      });
    }

    // Sort by size descending (largest communities first)
    return communities.sort((a, b) => b.size - a.size);
  }

  // ─── File Utilities (Secure & Atomic) ─────────────────────────────────────

  /**
   * Load the code graph from disk.
   */
  async loadGraph(): Promise<CodeGraph> {
    if (!fs.existsSync(this.graphPath)) {
      throw new Error('Code graph file does not exist');
    }
    
    // Check file size
    this.security.checkFileSize(this.graphPath);

    const raw = fs.readFileSync(this.graphPath, 'utf8').trim();
    if (raw.length === 0) {
      throw new Error('Code graph file is empty');
    }

    // Decrypt if it's stored encrypted, else parse directly (with auto-migration support)
    try {
      if (this.security.isEncrypted(raw)) {
        const decrypted = this.security.decrypt(raw);
        return JSON.parse(decrypted);
      }
      const parsed = JSON.parse(raw);
      // Auto-migrate
      await this.saveGraph(parsed);
      return parsed;
    } catch {
      throw new Error('Failed to load code graph');
    }
  }

  /**
   * Save the code graph to disk atomically with encryption.
   */
  async saveGraph(graph: CodeGraph): Promise<void> {
    const jsonStr = JSON.stringify(graph, null, 2);
    const encrypted = this.security.encrypt(jsonStr);

    // Atomic write
    const tmpPath = this.graphPath + `.tmp.${crypto.randomBytes(4).toString('hex')}`;
    try {
      fs.writeFileSync(tmpPath, encrypted, { mode: 0o600 });
      fs.renameSync(tmpPath, this.graphPath);
      this.security.setSecurePermissions(this.graphPath);
    } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch {}
      throw e;
    }

    // Also write metadata
    const meta = {
      updatedAt: graph.updatedAt,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      version: graph.version
    };
    const metaTmpPath = this.metaPath + `.tmp.${crypto.randomBytes(4).toString('hex')}`;
    try {
      fs.writeFileSync(metaTmpPath, JSON.stringify(meta, null, 2), { mode: 0o600 });
      fs.renameSync(metaTmpPath, this.metaPath);
      this.security.setSecurePermissions(this.metaPath);
    } catch (e) {
      try { fs.unlinkSync(metaTmpPath); } catch {}
    }
  }

  // ─── Snapshots & Diffing ────────────────────────────────────────────────

  /**
   * Create a snapshot of the current code graph and return its ID.
   * Auto-cleans up keeping only the 5 most recent snapshots.
   */
  async createGraphSnapshot(): Promise<string> {
    if (!fs.existsSync(this.graphPath)) {
      return '';
    }
    const snapshotId = `snapshot-${Date.now()}`;
    const targetPath = path.join(this.snapshotDirPath, `${snapshotId}.json`);
    
    // Copy the current graph
    fs.copyFileSync(this.graphPath, targetPath);
    this.security.setSecurePermissions(targetPath);

    // Cleanup old snapshots
    try {
      const files = fs.readdirSync(this.snapshotDirPath);
      const snapshots = files
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(this.snapshotDirPath, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      if (snapshots.length > 5) {
        for (const s of snapshots.slice(5)) {
          fs.unlinkSync(path.join(this.snapshotDirPath, s.name));
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    return snapshotId;
  }

  /**
   * Load a specific graph snapshot.
   */
  async loadGraphSnapshot(snapshotId: string): Promise<CodeGraph | null> {
    const targetPath = path.join(this.snapshotDirPath, `${snapshotId}.json`);
    if (!fs.existsSync(targetPath)) return null;
    try {
      const content = fs.readFileSync(targetPath, 'utf8');
      const decrypted = this.security.decrypt(content);
      return JSON.parse(decrypted) as CodeGraph;
    } catch {
      return null;
    }
  }

  /**
   * Diff two CodeGraphs and return the delta.
   */
  diffCodeGraph(oldGraph: CodeGraph, newGraph: CodeGraph): GraphDiff {
    const oldNodesMap = new Map(oldGraph.nodes.map(n => [n.id, n]));
    const newNodesMap = new Map(newGraph.nodes.map(n => [n.id, n]));
    const oldEdgesSet = new Set(oldGraph.edges.map(e => `${e.from}::${e.to}::${e.kind}`));
    const newEdgesSet = new Set(newGraph.edges.map(e => `${e.from}::${e.to}::${e.kind}`));

    const addedNodes = newGraph.nodes.filter(n => !oldNodesMap.has(n.id));
    const removedNodes = oldGraph.nodes.filter(n => !newNodesMap.has(n.id));
    
    const addedEdges = newGraph.edges.filter(e => !oldEdgesSet.has(`${e.from}::${e.to}::${e.kind}`));
    const removedEdges = oldGraph.edges.filter(e => !newEdgesSet.has(`${e.from}::${e.to}::${e.kind}`));

    return { addedNodes, removedNodes, addedEdges, removedEdges };
  }
}

// Re-export report utilities
export { generateGraphReport, writeGraphReport } from './report';
export type { GraphReportOptions } from './report';
