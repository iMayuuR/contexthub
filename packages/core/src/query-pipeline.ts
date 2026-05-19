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

  function rrfMerge<T extends { id: string }>(
    lists: Array<Array<T>>,
    k = 60
  ): Map<string, number> {
    const scores = new Map<string, number>();
    for (const list of lists) {
      list.forEach((item, i) => {
        scores.set(item.id, (scores.get(item.id) || 0) + 1 / (k + i + 1));
      });
    }
    return scores;
  }

  // 1. Code Graph Traversal
  const codeHits: Array<{ path: string; symbol?: string; reason: string }> = [];
  let trace: { hops: Array<{ type: string; id: string; label: string }> } | undefined = undefined;

  try {
    if (graphManager) {
      const graph = await graphManager.loadGraph();
      
      const referencedNodes: CodeGraphNode[] = [];
      for (const node of graph.nodes) {
        if (node.kind === 'file') {
          const basename = path.basename(node.path).toLowerCase();
          if (queryLower.includes(basename)) {
            referencedNodes.push(node);
          }
        } else if (node.kind === 'symbol' && node.name) {
          const symLower = node.name.toLowerCase();
          const regex = new RegExp('\\b' + symLower + '\\b');
          if (regex.test(queryLower)) {
            referencedNodes.push(node);
          }
        }
      }

      for (const node of referencedNodes) {
        codeHits.push({
          path: node.path,
          symbol: node.kind === 'symbol' ? node.name : undefined,
          reason: `Directly mentioned in query`
        });

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

  // 2. Git Recent Changes
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

  // 3. Load Memories
  let allMemories: MemoryEntry[] = [];
  try {
    allMemories = await core.searchMemories({ limit: 1000 });
  } catch (e) {}

  // 4. Semantic Search
  let semanticResults: VectorSearchResult[] = [];
  try {
    if (vectorEngine && allMemories.length > 0) {
      semanticResults = await vectorEngine.searchSimilarText(sanitizedQuery, allMemories, 50);
    }
  } catch (e) {}

  // 5. Keyword Search
  const keywordResults = allMemories.filter(mem =>
    mem.content.toLowerCase().includes(queryLower) ||
    mem.tags.some(tag => tag.toLowerCase().includes(queryLower))
  ).slice(0, 50);

  // 6. Graph Pseudo-hits
  const graphMemories = allMemories.filter(mem => {
    const matchPath = mem.relatedPaths?.some(p => codeHits.some(c => c.path === p));
    const matchSym = mem.relatedSymbols?.some(s => codeHits.some(c => c.symbol === s));
    return matchPath || matchSym;
  }).slice(0, 50);

  // 7. Git Pseudo-hits
  const gitMemories = allMemories.filter(mem => {
    if (!mem.commitHash || !gitHits) return false;
    return gitHits.some(g => mem.commitHash!.startsWith(g.hash));
  }).slice(0, 50);

  // 8. RRF Merge
  const rrfScores = rrfMerge([
    semanticResults as any,
    keywordResults,
    graphMemories,
    gitMemories
  ]);

  const sortedMemories = Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => allMemories.find(m => m.id === id)!)
    .filter(Boolean)
    .slice(0, safeLimit);

  // 9. Deterministic Stitched Answer Summary
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
