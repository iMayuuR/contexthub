/**
 * Context Bundle & Symbol Explainer
 *
 * Merges project context, unified query results, graph symbols/blast radius,
 * session memories, git summary, and suggested tools into a single JSON payload.
 * Capped at 256KB to stay within LLM context limits.
 */

import { ContextHubCore, SecurityManager, runUnifiedQuery, MAX_QUERY_LIMIT } from '@imayuur/contexthub-core';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { GitIntegration } from '@imayuur/contexthub-git-integration';
import type { MemoryEntry } from '@imayuur/contexthub-shared-types';

const MAX_BUNDLE_BYTES = 256 * 1024; // 256KB

export interface ContextBundle {
  project: {
    name: string;
    description: string;
    language?: string;
    framework?: string;
  };
  query?: {
    text: string;
    memories: Array<{ id: string; type: string; contentPreview: string; tags: string[] }>;
    codeHits: Array<{ path: string; symbol?: string; reason: string }>;
  };
  symbols?: Array<{ id: string; name?: string; path: string; kind: string }>;
  blastRadius?: { nodes: number; edges: number; topFiles: string[] };
  sessionMemories?: Array<{ type: string; contentPreview: string; timestamp: number }>;
  git?: {
    branch: string;
    recentCommits: Array<{ hash: string; message: string }>;
  };
  suggestedTools: string[];
  truncated: boolean;
}

export interface SymbolExplanation {
  symbol: string;
  definition?: { path: string; kind: string };
  callers: Array<{ id: string; path: string; name?: string }>;
  relatedMemories: Array<{ id: string; type: string; contentPreview: string }>;
}

/**
 * Build a comprehensive context bundle for an agent.
 */
export async function buildContextBundle(
  options: {
    query?: string;
    path?: string;
    repoPath: string;
  },
  core: ContextHubCore,
  vectorEngine: VectorEngine | null,
  graphManager: CodeGraphManager | null,
  gitIntegration: GitIntegration | null
): Promise<ContextBundle> {
  const security = new SecurityManager(options.repoPath);

  // 1. Project context
  const metadata = await core.getProjectMetadata();
  const project = {
    name: metadata?.name || 'Unknown Project',
    description: metadata?.description || 'No description',
    language: metadata?.language,
    framework: metadata?.framework
  };

  // 2. Optional unified query
  let query: ContextBundle['query'] | undefined;
  if (options.query) {
    try {
      const result = await runUnifiedQuery(
        options.query, 10, core, vectorEngine, graphManager, gitIntegration
      );
      query = {
        text: options.query,
        memories: result.memories.slice(0, 10).map(m => ({
          id: m.id,
          type: m.type,
          contentPreview: m.content.substring(0, 200),
          tags: m.tags
        })),
        codeHits: result.codeHits.slice(0, 10)
      };
    } catch {}
  }

  // 3. Symbols / blast radius for path
  let symbols: ContextBundle['symbols'] | undefined;
  let blastRadius: ContextBundle['blastRadius'] | undefined;
  if (options.path && graphManager) {
    try {
      const related = await graphManager.getRelatedSymbols(options.path, 15);
      symbols = related.map(n => ({
        id: n.id,
        name: n.name,
        path: n.path || '',
        kind: n.kind
      }));

      const blast = await graphManager.getBlastRadius(options.path, 2);
      blastRadius = {
        nodes: blast.nodes.length,
        edges: blast.edges.length,
        topFiles: blast.nodes
          .filter(n => n.kind === 'file')
          .slice(0, 10)
          .map(n => n.path || n.id)
      };
    } catch {}
  }

  // 4. Session memories (most recent session)
  let sessionMemories: ContextBundle['sessionMemories'] | undefined;
  try {
    const sessions = await core.getSessions(1);
    if (sessions.length > 0) {
      const mems = await core.searchMemories({ sessionId: sessions[0].id, limit: 20 });
      sessionMemories = mems.map(m => ({
        type: m.type,
        contentPreview: m.content.substring(0, 150),
        timestamp: m.timestamp
      }));
    }
  } catch {}

  // 5. Git summary
  let git: ContextBundle['git'] | undefined;
  if (gitIntegration) {
    try {
      const summary = await gitIntegration.getGitSummary();
      git = {
        branch: summary.currentBranch,
        recentCommits: summary.recentCommits.slice(0, 5).map((c: any) => ({
          hash: c.hash.substring(0, 7),
          message: c.message
        }))
      };
    } catch {}
  }

  // 6. Suggested tools
  const suggestedTools: string[] = ['search_memory', 'contexthub_query'];
  if (options.path) {
    suggestedTools.push('get_blast_radius', 'get_related_symbols', 'explain_symbol');
  }
  if (graphManager) {
    suggestedTools.push('get_god_nodes', 'get_graph_communities');
  }

  // Assemble bundle
  const bundle: ContextBundle = {
    project,
    query,
    symbols,
    blastRadius,
    sessionMemories,
    git,
    suggestedTools,
    truncated: false
  };

  // 7. Enforce 256KB cap
  let json = JSON.stringify(bundle);
  if (json.length > MAX_BUNDLE_BYTES) {
    // Progressively trim: session memories → query memories → symbols
    if (bundle.sessionMemories) {
      bundle.sessionMemories = bundle.sessionMemories.slice(0, 5);
    }
    if (bundle.query?.memories) {
      bundle.query.memories = bundle.query.memories.slice(0, 5);
    }
    if (bundle.symbols) {
      bundle.symbols = bundle.symbols.slice(0, 5);
    }
    bundle.truncated = true;
  }

  return bundle;
}

/**
 * Explain a symbol: its definition, callers, and related memories.
 */
export async function explainSymbol(
  symbolId: string,
  repoPath: string,
  core: ContextHubCore,
  graphManager: CodeGraphManager | null
): Promise<SymbolExplanation> {
  const security = new SecurityManager(repoPath);
  const sanitized = security.sanitizeInput(symbolId, 500);

  const explanation: SymbolExplanation = {
    symbol: sanitized,
    callers: [],
    relatedMemories: []
  };

  if (graphManager) {
    try {
      const graph = await graphManager.loadGraph();

      // Find the node definition
      const node = graph.nodes.find(n => n.id === sanitized || n.name === sanitized);
      if (node) {
        explanation.definition = {
          path: node.path || node.id,
          kind: node.kind
        };

        // Find callers (incoming edges)
        const blast = await graphManager.getBlastRadius(node.id, 1);
        explanation.callers = blast.nodes.slice(0, 15).map(n => ({
          id: n.id,
          path: n.path || n.id,
          name: n.name
        }));
      }
    } catch {}
  }

  // Find related memories
  try {
    const memories = await core.searchMemories({ limit: 500 });
    const symbolLower = sanitized.toLowerCase();
    explanation.relatedMemories = memories
      .filter(m =>
        m.relatedSymbols?.some(s => s.toLowerCase().includes(symbolLower)) ||
        m.relatedPaths?.some(p => p.toLowerCase().includes(symbolLower)) ||
        m.content.toLowerCase().includes(symbolLower)
      )
      .slice(0, 10)
      .map(m => ({
        id: m.id,
        type: m.type,
        contentPreview: m.content.substring(0, 200)
      }));
  } catch {}

  return explanation;
}
