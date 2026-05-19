import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { VectorEngine } from '@contexthub/vector-engine';
import { CodeGraphManager } from '@contexthub/knowledge-graph';
import { ContextHubCore, SecurityManager } from '@contexthub/core';

export class DocsIngester {
  private repoPath: string;
  private vectorEngine: VectorEngine;
  private graphManager: CodeGraphManager;
  private security: SecurityManager;

  constructor(repoPath: string, vectorEngine: VectorEngine, graphManager: CodeGraphManager) {
    this.repoPath = repoPath;
    this.vectorEngine = vectorEngine;
    this.graphManager = graphManager;
    this.security = new SecurityManager(repoPath);
  }

  /**
   * Find markdown files and ingest them.
   */
  async ingestMarkdown(patterns: string[] = ['**/*.md']): Promise<number> {
    let filesIngested = 0;
    
    // Find all matching files
    const matches = new Set<string>();
    for (const pattern of patterns) {
      const paths = await glob(pattern, {
        cwd: this.repoPath,
        ignore: ['node_modules/**', '.git/**', '.contexthub/**', 'dist/**'],
        absolute: true,
        nodir: true
      });
      paths.forEach(p => matches.add(p));
    }

    let graph;
    try {
      graph = await this.graphManager.loadGraph();
    } catch (e: any) {
      if (e.message?.includes('does not exist')) {
        graph = { nodes: [], edges: [], updatedAt: Date.now(), version: '1.0' };
      } else {
        throw e;
      }
    }
    let graphModified = false;

    for (const filePath of matches) {
      if (this.security.isSensitiveFile(filePath)) continue;

      const stats = fs.statSync(filePath);
      if (stats.size > 1024 * 1024) continue; // Skip files larger than 1MB

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Chunk content
      const chunks = this.chunkText(content, 8000, 200);
      
      // Add to vector engine
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `doc_${path.relative(this.repoPath, filePath)}_${i}`;
        const embedding = await this.vectorEngine.generateEmbedding(chunks[i]);
        await this.vectorEngine.updateEmbedding(chunkId, embedding);
      }

      // Add to knowledge graph
      const relPath = path.relative(this.repoPath, filePath);
      const existingNode = graph.nodes.find(n => n.path === relPath);
      if (!existingNode) {
        graph.nodes.push({
          id: `file:${relPath}`,
          kind: 'file', // Should technically be 'doc', but schema allows 'file' | 'symbol'
          path: relPath,
        });
        graphModified = true;
      }
      
      filesIngested++;
    }

    if (graphModified) {
      await this.graphManager.saveGraph(graph);
    }

    return filesIngested;
  }

  /**
   * Search ingested documents
   */
  async searchDocs(query: string, limit: number = 10) {
    const sanitizedQuery = this.security.sanitizeQuery(query);
    const queryEmbedding = await this.vectorEngine.generateEmbedding(sanitizedQuery);
    
    // searchSimilar is available on vector engine
    const results = await this.vectorEngine.searchSimilar(queryEmbedding, limit * 2);
    
    // Filter out memory entries, keep only docs
    const docResults = results.filter(r => r.id.startsWith('doc_')).slice(0, limit);
    return docResults.map(r => ({
      id: r.id,
      score: r.score
    }));
  }

  /**
   * Basic sliding window chunker
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      const end = Math.min(i + chunkSize, text.length);
      chunks.push(text.slice(i, end));
      if (end === text.length) break;
      i += (chunkSize - overlap);
    }
    return chunks;
  }
}
