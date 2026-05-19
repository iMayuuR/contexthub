import type { ContextHubCore } from './index';
import type { MemoryEntry, VectorSearchResult, CodeGraphNode } from '@contexthub/shared-types';
import * as path from 'path';

export interface UnifiedQueryResult {
  answerSummary: string;
  memories: MemoryEntry[];
  codeHits: Array<{ path: string; symbol?: string; reason: string }>;
  gitHits?: any[];
  trace?: { hops: Array<{ type: string; id: string; label: string }> };
}

export async function runUnifiedQuery(
  query: string,
  limit: number,
  core: ContextHubCore,
  vectorEngine: any,
  graphManager: any,
  gitIntegration: any
): Promise<UnifiedQueryResult> {
  const security = core['storage']['security']; // Access security manager safely
  const sanitizedQuery = security.sanitizeQuery(query);
  const safeLimit = security.validateLimit(limit, 1, 100);

  const queryLower = sanitizedQuery.toLowerCase();

  // 1. Semantic Search
  let semanticResults: VectorSearchResult[] = [];
  try {
    if (vectorEngine) {
      const allMemories = await core.searchMemories({ limit: 1000 });
      semanticResults = await vectorEngine.searchSimilarText(sanitizedQuery, allMemories, safeLimit);
    }
  } catch (e) {
    // Ignore and fallback
  }

  // 2. Keyword Search
  let keywordResults: MemoryEntry[] = [];
  try {
    const allMemories = await core.searchMemories({ limit: 1000 });
    keywordResults = allMemories.filter(mem =>
      mem.content.toLowerCase().includes(queryLower) ||
      mem.tags.some(tag => tag.toLowerCase().includes(queryLower))
    );
  } catch (e) {
    // Ignore
  }

  // Combine and deduplicate memories
  const memoriesMap = new Map<string, { memory: MemoryEntry; score: number }>();
  
  // Seed with semantic results
  for (const res of semanticResults) {
    if (res.metadata) {
      memoriesMap.set(res.id, { memory: res.metadata, score: res.score });
    }
  }
  
  // Merge keyword results
  for (const mem of keywordResults) {
    const existing = memoriesMap.get(mem.id);
    const score = existing ? Math.max(existing.score, 0.8) : 0.5; // High score if keyword matches
    memoriesMap.set(mem.id, { memory: mem, score });
  }

  // Sort and limit memories
  const sortedMemories = Array.from(memoriesMap.values())
    .sort((a, b) => b.score - a.score)
    .map(x => x.memory)
    .slice(0, safeLimit);

  // 3. Code Graph Traversal
  const codeHits: Array<{ path: string; symbol?: string; reason: string }> = [];
  let trace: { hops: Array<{ type: string; id: string; label: string }> } | undefined = undefined;

  try {
    if (graphManager) {
      const graph = await graphManager.loadGraph();
      
      // Find matching files or symbols referenced in the query
      const referencedNodes: CodeGraphNode[] = [];
      
      for (const node of graph.nodes) {
        if (node.kind === 'file') {
          const basename = path.basename(node.path).toLowerCase();
          if (queryLower.includes(basename)) {
            referencedNodes.push(node);
          }
        } else if (node.kind === 'symbol' && node.name) {
          const symLower = node.name.toLowerCase();
          // Match whole symbol name if possible to avoid false partials
          const regex = new RegExp('\\b' + symLower + '\\b');
          if (regex.test(queryLower)) {
            referencedNodes.push(node);
          }
        }
      }

      // Add referenced nodes as direct hits
      for (const node of referencedNodes) {
        codeHits.push({
          path: node.path,
          symbol: node.kind === 'symbol' ? node.name : undefined,
          reason: `Directly mentioned in query`
        });

        // Fetch direct neighbors/related symbols
        const related = await graphManager.getRelatedSymbols(node.id, 5);
        for (const rel of related) {
          if (!codeHits.some(h => h.path === rel.path && h.symbol === rel.name)) {
            codeHits.push({
              path: rel.path,
              symbol: rel.name,
              reason: `Related symbol to '${node.name || path.basename(node.path)}' in graph`
            });
          }
        }
      }

      // BFS trace path if two entities are detected
      if (referencedNodes.length >= 2) {
        const fromNode = referencedNodes[0];
        const toNode = referencedNodes[1];
        const pathHops = await graphManager.tracePath(fromNode.id, toNode.id, 5);
        if (pathHops) {
          trace = { hops: pathHops };
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // 4. Git Recent Changes
  let gitHits: any[] | undefined = undefined;
  const historyKeywords = ['recent', 'change', 'git', 'commit', 'log', 'history', 'branch', 'timeline'];
  const wantsHistory = historyKeywords.some(kw => queryLower.includes(kw));

  if (wantsHistory && gitIntegration) {
    try {
      const summary = await gitIntegration.getGitSummary();
      gitHits = summary.recentCommits.slice(0, 5).map((c: any) => ({
        hash: c.hash.substring(0, 7),
        message: c.message,
        author: c.author,
        date: c.date
      }));
    } catch (e) {
      // Ignore
    }
  }

  // 5. Deterministic Stitched Answer Summary
  let answerSummary = `### ContextHub Query Results for "${sanitizedQuery}"\n\n`;
  answerSummary += `* Found ${sortedMemories.length} relevant memory entries.\n`;
  if (codeHits.length > 0) {
    answerSummary += `* Identified ${codeHits.length} related symbols/files in the local knowledge graph.\n`;
  }
  if (gitHits && gitHits.length > 0) {
    answerSummary += `* Retrieved ${gitHits.length} recent commits from git repository history.\n`;
  }
  if (trace) {
    answerSummary += `* Traced dependency connection path: ${trace.hops.map(h => `\`${h.label}\` (${h.type})`).join(' → ')}\n`;
  }

  return {
    answerSummary,
    memories: sortedMemories,
    codeHits: codeHits.slice(0, safeLimit),
    gitHits,
    trace
  };
}
