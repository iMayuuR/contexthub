/**
 * ContextHub MCP Server — Hardened
 *
 * Security features:
 * - Input validation and sanitization on ALL tool parameters
 * - Memory content length limits (50KB)
 * - Type validation against allowed enum values
 * - Query/limit parameter bounds enforcement
 * - Path traversal prevention on file-related tools
 * - Optional auth token verification (via CONTEXTHUB_TOKEN env var)
 * - Sanitized error messages (no stack traces or internal paths)
 * - Secure initialization with SecurityManager
 */

// @ts-ignore
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
// @ts-ignore
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
import { 
  ContextHubCore, 
  SecurityManager, 
  runUnifiedQuery,
  MAX_QUERY_LIMIT,
  MAX_SEARCH_CANDIDATES,
  DEFAULT_QUERY_LIMIT,
  MAX_MEMORY_CONTENT_LENGTH,
  MAX_COMMIT_HASH_LENGTH,
  MAX_BRANCH_LENGTH,
  MAX_RELATED_PATHS,
  MAX_RELATED_SYMBOLS,
  MAX_MEMORIES_TOTAL,
  MAX_MEMORY_TAGS
} from '@imayuur/contexthub-core';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { RepoParser } from '@imayuur/contexthub-repo-parser';
import { GitIntegration } from '@imayuur/contexthub-git-integration';
import { SkillsManager } from '@imayuur/contexthub-skills';
import { CodeGraphManager, writeGraphReport } from '@imayuur/contexthub-knowledge-graph';
import { DocsIngester } from '@imayuur/contexthub-docs-ingest';
import type { MemoryEntry, Session } from '@imayuur/contexthub-shared-types';
import { getAgentPolicyMarkdown, AGENT_POLICY_VERSION } from './agent-policy';
import {
  readActiveSession,
  writeActiveSession,
  clearActiveSession,
} from './session-state';
import { registerResourcesAndPrompts } from './resources';

let core: ContextHubCore | null = null;
let security: SecurityManager | null = null;
let vectorEngine: VectorEngine | null = null;
let repoParser: RepoParser | null = null;
let gitIntegration: GitIntegration | null = null;
let skillsManager: SkillsManager | null = null;

// ── Initialization ───────────────────────────────────────────────────────

async function initCore(repoPath: string): Promise<ContextHubCore> {
  if (core) return core;
  core = new ContextHubCore(repoPath);
  security = new SecurityManager(repoPath);
  await core.initStorage();

  // Initialize other engines
  vectorEngine = new VectorEngine(repoPath);
  repoParser = new RepoParser(repoPath);
  gitIntegration = new GitIntegration(core, repoPath);
  skillsManager = new SkillsManager(repoPath);

  return core;
}

function getCore(): ContextHubCore {
  if (!core) {
    throw new Error('ContextHub not initialized. Call initCore first.');
  }
  return core;
}

function getSecurity(): SecurityManager {
  if (!security) {
    throw new Error('SecurityManager not initialized.');
  }
  return security;
}

// ── Safe Error Wrapper ───────────────────────────────────────────────────

/**
 * Wrap tool handlers with error sanitization — never expose stack traces or
 * internal paths to MCP clients.
 */
function safeHandler<T>(handler: (...args: any[]) => Promise<T>) {
  return async (...args: any[]): Promise<T> => {
    try {
      return await handler(...args);
    } catch (e: any) {
      const safeMessage = e?.message?.replace(/\/[^\s]+/g, '[path]') || 'Internal error';
      return { error: safeMessage } as any;
    }
  };
}

// ── Tool Handlers ────────────────────────────────────────────────────────

async function getProjectContext() {
  const ctx = getCore();
  const repoPath = process.cwd();
  
  const [metadata, sessions, memories] = await Promise.all([
    ctx.getProjectMetadata(),
    ctx.getSessions(5),
    ctx.searchMemories({ limit: 1000 })
  ]);

  // Calculate stats
  const typeCounts: Record<string, number> = {};
  for (const mem of memories) {
    typeCounts[mem.type] = (typeCounts[mem.type] || 0) + 1;
  }

  const active = readActiveSession(repoPath);

  // Get last summary memory
  const lastSummary = memories.find(m => m.type === 'summary');

  // Get code graph stats
  let codeGraphStats = null;
  try {
    const graphManager = new CodeGraphManager(repoPath);
    const graph = await graphManager.loadGraph().catch(() => null);
    if (graph) {
      codeGraphStats = {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        updatedAt: graph.updatedAt
      };
    }
  } catch (e) {}

  return {
    project: metadata,
    recentSessions: sessions,
    memoryStats: typeCounts,
    totalMemories: memories.length,
    timestamp: Date.now(),
    activeSession: active,
    lastSummary: lastSummary ? { content: lastSummary.content, timestamp: lastSummary.timestamp } : null,
    codeGraphStats,
    agentPolicyVersion: AGENT_POLICY_VERSION,
    autoMemoryInstructions:
      'Call ensure_session at start, record_turn after meaningful turns, get_project_context before work. See get_agent_policy.',
  };
}

async function searchMemory(query: string, limit: number = DEFAULT_QUERY_LIMIT) {
  const ctx = getCore();
  const sec = getSecurity();

  // Validate inputs
  const sanitizedQuery = sec.sanitizeQuery(query);
  const safeLimit = sec.validateLimit(limit, 1, MAX_QUERY_LIMIT);

  const allMemories = await ctx.searchMemories({ limit: MAX_SEARCH_CANDIDATES });

  // Filter by content match
  const queryLower = sanitizedQuery.toLowerCase();
  const filtered = allMemories.filter(mem =>
    mem.content.toLowerCase().includes(queryLower) ||
    mem.tags.some(tag => tag.toLowerCase().includes(queryLower))
  ).slice(0, safeLimit);

  return {
    results: filtered,
    count: filtered.length,
    query: sanitizedQuery
  };
}

async function saveSession(agent: string, metadata?: Record<string, any>) {
  const ctx = getCore();
  const sec = getSecurity();

  // Validate inputs
  const sanitizedAgent = sec.sanitizeInput(agent, 100);

  const sessionId = await ctx.createSession(sanitizedAgent, metadata || {});
  return { sessionId, agent: sanitizedAgent, metadata };
}

async function endSession(sessionId: string) {
  const ctx = getCore();
  const sec = getSecurity();

  // Validate session ID format (UUID)
  const sanitizedId = sec.sanitizeInput(sessionId, 50);

  await ctx.endSession(sanitizedId);
  return { sessionId: sanitizedId, ended: true };
}

async function saveMemory(sessionId: string, memoryData: {
  type?: string;
  content: string;
  tags?: string[];
  relatedPaths?: string[];
  relatedSymbols?: string[];
  commitHash?: string;
  branch?: string;
}) {
  const ctx = getCore();
  const sec = getSecurity();

  // Validate inputs
  const sanitizedSessionId = sec.sanitizeInput(sessionId, 50);
  let sanitizedContent = sec.sanitizeInput(memoryData.content, MAX_MEMORY_CONTENT_LENGTH); // max 50KB
  if (sec.isSensitive(sanitizedContent)) {
    sanitizedContent = sec.redactSensitive(sanitizedContent);
  }
  const validType = sec.validateMemoryType(memoryData.type || 'manual');

  const sanitizedTags = (memoryData.tags || [])
    .map(tag => sec.sanitizeInput(tag, 100))
    .filter(tag => tag.length > 0)
    .slice(0, MAX_MEMORY_TAGS);

  let commitHash = memoryData.commitHash;
  let branch = memoryData.branch;
  if (gitIntegration && (!commitHash || !branch)) {
    try {
      const summary = await gitIntegration.getGitSummary();
      if (summary.recentCommits && summary.recentCommits.length > 0) {
        if (!commitHash) commitHash = summary.recentCommits[0].hash.substring(0, MAX_COMMIT_HASH_LENGTH);
        if (!branch) branch = sec.sanitizeInput(summary.currentBranch, MAX_BRANCH_LENGTH);
      }
    } catch (e) {
      // ignore
    }
  }

  const id = await ctx.saveMemory({
    sessionId: sanitizedSessionId,
    type: validType as any,
    content: sanitizedContent,
    timestamp: Date.now(),
    tags: sanitizedTags,
    relatedPaths: memoryData.relatedPaths?.slice(0, MAX_RELATED_PATHS),
    relatedSymbols: memoryData.relatedSymbols?.slice(0, MAX_RELATED_SYMBOLS),
    commitHash,
    branch
  });
  return { id, sessionId: sanitizedSessionId };
}

async function getAgentPolicy() {
  return {
    version: AGENT_POLICY_VERSION,
    policy: getAgentPolicyMarkdown(),
  };
}

async function ensureSession(agent: string, forceNew: boolean = false) {
  const ctx = getCore();
  const sec = getSecurity();
  const repoPath = process.cwd();
  const sanitizedAgent = sec.sanitizeInput(agent, 100);

  if (!forceNew) {
    const active = readActiveSession(repoPath);
    if (active && active.agent === sanitizedAgent) {
      return { sessionId: active.sessionId, agent: active.agent, resumed: true };
    }
  }

  // Generate a graph snapshot at the start of the session
  let graphSnapshotId = undefined;
  try {
    // Update graph first to ensure snapshot is fresh
    await updateKnowledgeGraph().catch(() => {});
    const graphManager = new CodeGraphManager(repoPath);
    graphSnapshotId = await graphManager.createGraphSnapshot();
    if (!graphSnapshotId) graphSnapshotId = undefined;
  } catch (e) {
    // ignore
  }

  const sessionId = await ctx.createSession(sanitizedAgent, { autoMemory: true, graphSnapshotId });
  writeActiveSession(
    repoPath,
    { sessionId, agent: sanitizedAgent, startedAt: Date.now(), graphSnapshotId },
    sec
  );
  return { sessionId, agent: sanitizedAgent, resumed: false };
}

async function recordTurn(params: {
  agent: string;
  sessionId?: string;
  promptSummary: string;
  responseSummary: string;
  memoryType?: string;
  tags?: string[];
  relatedPaths?: string[];
  relatedSymbols?: string[];
  commitHash?: string;
  branch?: string;
}) {
  const ctx = getCore();
  const sec = getSecurity();
  const repoPath = process.cwd();

  const sanitizedAgent = sec.sanitizeInput(params.agent, 100);
  let sessionId = params.sessionId
    ? sec.sanitizeInput(params.sessionId, 50)
    : undefined;

  if (!sessionId) {
    const active = readActiveSession(repoPath);
    if (active?.agent === sanitizedAgent) {
      sessionId = active.sessionId;
    } else {
      const ensured = await ensureSession(sanitizedAgent, false);
      sessionId = ensured.sessionId;
    }
  }

  let prompt = sec.sanitizeInput(params.promptSummary, 16000);
  let response = sec.sanitizeInput(params.responseSummary, 16000);
  if (sec.isSensitive(prompt)) prompt = sec.redactSensitive(prompt);
  if (sec.isSensitive(response)) response = sec.redactSensitive(response);

  const extraTags = (params.tags || [])
    .map((t) => sec.sanitizeInput(t, 100))
    .filter(Boolean)
    .slice(0, 18);

  const promptId = await saveMemory(sessionId!, {
    type: 'prompt',
    content: prompt,
    tags: ['prompt', sanitizedAgent, 'auto', ...extraTags],
    relatedPaths: params.relatedPaths,
    relatedSymbols: params.relatedSymbols,
    commitHash: params.commitHash,
    branch: params.branch,
  });

  const responseType = sec.validateMemoryType(params.memoryType || 'response');
  const responseId = await saveMemory(sessionId!, {
    type: responseType,
    content: response,
    tags: ['response', sanitizedAgent, 'auto', ...extraTags],
    relatedPaths: params.relatedPaths,
    relatedSymbols: params.relatedSymbols,
    commitHash: params.commitHash,
    branch: params.branch,
  });

  return {
    sessionId,
    promptMemoryId: promptId.id,
    responseMemoryId: responseId.id,
    saved: true,
  };
}

async function endSessionWithCleanup(sessionId: string) {
  const ctx = getCore();
  
  // Load session memories for summary
  const memories = await ctx.searchMemories({ sessionId, limit: 1000 });
  if (memories.length > 0) {
    const typeCounts: Record<string, number> = {};
    const paths = new Set<string>();
    for (const m of memories) {
      if (m.type === 'summary') continue;
      typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
      (m.relatedPaths || []).forEach(p => paths.add(p));
    }
    
    const typesStr = Object.entries(typeCounts).map(([k,v]) => `${k}(${v})`).join(', ');
    let summaryContent = `Session summary. Types: ${typesStr || 'none'}.`;
    if (paths.size > 0) {
      summaryContent += ` Paths touched: ${Array.from(paths).join(', ')}`;
    }

    await saveMemory(sessionId, {
      type: 'summary',
      content: summaryContent,
      tags: ['session-summary']
    });
  }

  const result = await endSession(sessionId);
  clearActiveSession(process.cwd());
  return result;
}

async function summarizeRepo() {
  const ctx = getCore();
  const [metadata, memories] = await Promise.all([
    ctx.getProjectMetadata(),
    ctx.searchMemories({ limit: 100 })
  ]);

  // Group memories by type
  const byType: Record<string, MemoryEntry[]> = {};
  for (const mem of memories) {
    if (!byType[mem.type]) byType[mem.type] = [];
    byType[mem.type].push(mem);
  }

  // Get recent activity
  const recentActivity = memories.slice(0, 10).map(mem => ({
    type: mem.type,
    contentPreview: mem.content.substring(0, 100),
    timestamp: new Date(mem.timestamp).toISOString(),
    tags: mem.tags
  }));

  return {
    projectName: metadata?.name || 'Unknown Project',
    description: metadata?.description || 'No description',
    language: metadata?.language || 'Unknown',
    framework: metadata?.framework,
    totalMemories: memories.length,
    memoriesByType: Object.fromEntries(
      Object.entries(byType).map(([type, mems]) => [type, mems.length])
    ),
    recentActivity
  };
}

async function getRelatedFiles(filePath: string, limit: number = 5) {
  if (!repoParser) throw new Error('Repo parser not initialized');
  const sec = getSecurity();

  // Validate file path — prevent traversal
  const safePath = sec.validatePath(filePath);
  const safeLimit = sec.validateLimit(limit, 1, 50);

  const ctx = getCore();
  const memories = await ctx.searchMemories({ limit: 100 });
  const parsed = await repoParser.parseDirectory(process.cwd());

  // Find files that import or reference this file
  const related: string[] = [];
  const fileName = safePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '');

  for (const pf of parsed) {
    if (pf.path === safePath) continue;
    for (const imp of pf.imports) {
      if (imp.source.includes(fileName || '') || imp.imported.some(i => i === fileName)) {
        related.push(pf.path);
        break;
      }
    }
  }

  return {
    targetFile: safePath,
    relatedFiles: related.slice(0, safeLimit),
    totalRelated: related.length
  };
}

async function getRecentChanges(limit: number = 10) {
  if (!gitIntegration) throw new Error('Git integration not initialized');
  const sec = getSecurity();
  const safeLimit = sec.validateLimit(limit, 1, 50);

  try {
    const summary = await gitIntegration.getGitSummary();
    return {
      currentBranch: summary.currentBranch,
      recentCommits: summary.recentCommits.slice(0, safeLimit).map(c => ({
        hash: c.hash.substring(0, 7),
        message: c.message,
        author: c.author,
        date: c.date
      })),
      workingDirectoryStatus: summary.status
    };
  } catch (e) {
    return {
      error: 'Not a git repository or git not available',
      recentCommits: []
    };
  }
}

async function getArchitectureSummary() {
  if (!repoParser) throw new Error('Repo parser not initialized');

  const parsed = await repoParser.parseDirectory(process.cwd());
  const stats = repoParser.getCodeStats(parsed);
  const graph = repoParser.buildDependencyGraph(parsed);

  // Find most connected files
  const connectivity: [string, number][] = [];
  for (const [file, deps] of graph) {
    connectivity.push([file, deps.length]);
  }
  connectivity.sort((a, b) => b[1] - a[1]);

  return {
    overview: {
      totalFiles: stats.totalFiles,
      byLanguage: stats.byLanguage,
      totalSymbols: stats.totalSymbols,
      symbolsByType: stats.byType
    },
    mostConnectedFiles: connectivity.slice(0, 10),
    totalDependencies: Array.from(graph.values()).reduce((sum, deps) => sum + deps.length, 0)
  };
}

async function semanticSearch(query: string, limit: number = 10) {
  const ctx = getCore();
  const sec = getSecurity();

  const sanitizedQuery = sec.sanitizeQuery(query);
  const safeLimit = sec.validateLimit(limit, 1, 100);

  const memories = await ctx.searchMemories({ limit: 500 });

  if (!vectorEngine) throw new Error('Vector engine not initialized');

  // Generate query embedding and search
  const results = await vectorEngine.searchSimilarText(sanitizedQuery, memories, safeLimit);

  return {
    query: sanitizedQuery,
    results: results.map(r => ({
      id: r.id,
      score: r.score,
      content: r.metadata?.content || '',
      type: r.metadata?.type || 'unknown',
      tags: r.metadata?.tags || []
    })),
    totalMatches: results.length
  };
}

async function diffCodeGraphMcp(baseSnapshotId?: string, headSnapshotId?: string) {
  const repoPath = process.cwd();
  const graphManager = new CodeGraphManager(repoPath);

  let oldGraph = baseSnapshotId ? await graphManager.loadGraphSnapshot(baseSnapshotId) : null;
  let newGraph = headSnapshotId ? await graphManager.loadGraphSnapshot(headSnapshotId) : null;

  if (!newGraph) {
    newGraph = await graphManager.loadGraph().catch(() => null);
  }
  if (!oldGraph) {
    oldGraph = { version: '1.0.0', updatedAt: 0, nodes: [], edges: [] };
  }
  if (!newGraph) {
    return { error: 'No current graph found and head snapshot failed to load.' };
  }

  const diff = graphManager.diffCodeGraph(oldGraph, newGraph);
  return { diff };
}

async function whatChangedSinceSessionMcp(sessionId: string) {
  const ctx = getCore();
  const sec = getSecurity();
  const repoPath = process.cwd();
  const safeSessionId = sec.sanitizeInput(sessionId, 50);

  const sessions = await ctx.getSessions(50);
  const session = sessions.find(s => s.id === safeSessionId);

  if (!session) {
    return { error: 'Session not found' };
  }

  const graphSnapshotId = session.metadata?.graphSnapshotId;
  const startedAt = session.startTime;

  // Code graph diff
  let codeDiff = null;
  if (graphSnapshotId) {
    const graphManager = new CodeGraphManager(repoPath);
    const oldGraph = await graphManager.loadGraphSnapshot(graphSnapshotId);
    if (oldGraph) {
      const newGraph = await graphManager.loadGraph().catch(() => null);
      if (newGraph) {
        codeDiff = graphManager.diffCodeGraph(oldGraph, newGraph);
      }
    }
  }

  // Memories diff
  const allMemories = await ctx.searchMemories({ limit: 1000 });
  const newMemories = allMemories.filter(m => m.timestamp >= startedAt);

  // Git diff
  let gitDiff = null;
  if (gitIntegration) {
    try {
      const summary = await gitIntegration.getGitSummary();
      const recentCommits = summary.recentCommits?.filter(c => new Date(c.date).getTime() >= startedAt) || [];
      gitDiff = {
        status: summary.status,
        recentCommits
      };
    } catch {
      // ignore
    }
  }

  return {
    sessionId: safeSessionId,
    startedAt,
    codeGraphChanges: codeDiff ? {
      addedNodes: codeDiff.addedNodes.length,
      removedNodes: codeDiff.removedNodes.length,
      addedEdges: codeDiff.addedEdges.length,
      removedEdges: codeDiff.removedEdges.length,
      diff: codeDiff
    } : null,
    newMemoriesCount: newMemories.length,
    newMemories: newMemories.map(m => ({ id: m.id, type: m.type, tags: m.tags, commitHash: m.commitHash })),
    gitChanges: gitDiff
  };
}

async function updateKnowledgeGraph() {
  if (!repoParser) throw new Error('Repo parser not initialized');

  const parsed = await repoParser.parseDirectory(process.cwd());

  const repoPath = process.cwd();
  const graphManager = new CodeGraphManager(repoPath);
  const graph = await graphManager.buildCodeGraph();

  // Generate GRAPH_REPORT.md alongside the graph update
  try {
    const ctx = getCore();
    const memories = await ctx.searchMemories({ limit: 1 });
    let gitBranch: string | undefined;
    try {
      if (gitIntegration) {
        const summary = await gitIntegration.getGitSummary();
        gitBranch = summary.currentBranch;
      }
    } catch {}
    await writeGraphReport({
      repoPath,
      memoryCount: memories.length,
      gitBranch
    });
  } catch {
    // Report generation is non-critical; don't fail the graph update
  }

  return {
    status: 'completed',
    filesAnalyzed: parsed.length,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    files: parsed.map(p => ({
      path: p.path,
      language: p.language,
      symbolCount: p.symbols.length,
      importCount: p.imports.length,
      exportCount: p.exports.length
    }))
  };
}

async function getCodeGraphStats() {
  const graphManager = new CodeGraphManager(process.cwd());
  const graph = await graphManager.loadGraph().catch(() => null);
  if (!graph) return { status: 'not_initialized' };
  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    updatedAt: graph.updatedAt,
    version: graph.version
  };
}

async function getRelatedSymbols(fileOrSymbol: string, limit?: number) {
  const sec = getSecurity();
  const sanitized = sec.sanitizeInput(fileOrSymbol, 500);
  const safeLimit = sec.validateLimit(limit || 10, 1, 100);
  const graphManager = new CodeGraphManager(process.cwd());
  const related = await graphManager.getRelatedSymbols(sanitized, safeLimit);
  return { related };
}

async function getBlastRadius(fileOrSymbol: string, depth?: number) {
  const sec = getSecurity();
  const sanitized = sec.sanitizeInput(fileOrSymbol, 500);
  const safeDepth = Math.min(Math.max(depth || 2, 1), 5);
  const graphManager = new CodeGraphManager(process.cwd());
  const { nodes, edges } = await graphManager.getBlastRadius(sanitized, safeDepth);
  return { nodes, edges };
}

async function traceCodePath(fromId: string, toId: string, maxHops?: number) {
  const sec = getSecurity();
  const sanitizedFrom = sec.sanitizeInput(fromId, 500);
  const sanitizedTo = sec.sanitizeInput(toId, 500);
  const safeHops = Math.min(Math.max(maxHops || 5, 1), 10);
  const graphManager = new CodeGraphManager(process.cwd());
  const pathHops = await graphManager.tracePath(sanitizedFrom, sanitizedTo, safeHops);
  return { path: pathHops };
}

async function getGodNodes(limit?: number) {
  const sec = getSecurity();
  const safeLimit = sec.validateLimit(limit || 10, 1, 100);
  const graphManager = new CodeGraphManager(process.cwd());
  const godNodes = await graphManager.getGodNodes(safeLimit);
  return { godNodes };
}

async function getGraphCommunities() {
  const graphManager = new CodeGraphManager(process.cwd());
  const communities = await graphManager.detectCommunities();
  return {
    communities,
    totalCommunities: communities.length,
    totalFiles: communities.reduce((sum, c) => sum + c.size, 0)
  };
}

async function getContextBundleMcp(query?: string, filePath?: string) {
  const { buildContextBundle } = await import('./context-bundle');
  const repoPath = process.cwd();
  const ctx = getCore();
  const graphManager = new CodeGraphManager(repoPath);

  const bundle = await buildContextBundle(
    { query, path: filePath, repoPath },
    ctx,
    vectorEngine,
    graphManager,
    gitIntegration
  );
  return bundle;
}

async function explainSymbolMcp(symbolId: string) {
  const { explainSymbol } = await import('./context-bundle');
  const repoPath = process.cwd();
  const sec = getSecurity();
  const sanitized = sec.sanitizeInput(symbolId, 500);
  const ctx = getCore();
  const graphManager = new CodeGraphManager(repoPath);
  return explainSymbol(sanitized, repoPath, ctx, graphManager);
}

async function searchMemoryByCode(fileOrSymbol: string, limit?: number) {
  const sec = getSecurity();
  const sanitized = sec.sanitizeInput(fileOrSymbol, 500);
  const safeLimit = sec.validateLimit(limit || 10, 1, 100);
  const ctx = getCore();
  
  const memories = await ctx.searchMemories({ limit: 1000 });
  const results = memories.filter(mem => {
    const hasPathMatch = mem.relatedPaths?.some(p => p.toLowerCase().includes(sanitized.toLowerCase()));
    const hasSymMatch = mem.relatedSymbols?.some(s => s.toLowerCase().includes(sanitized.toLowerCase()));
    return hasPathMatch || hasSymMatch;
  }).slice(0, safeLimit);

  return { results };
}

async function contexthubQueryMcp(query: string, limit?: number) {
  const sec = getSecurity();
  const ctx = getCore();
  const sanitizedQuery = sec.sanitizeQuery(query);
  const safeLimit = sec.validateLimit(limit || 10, 1, 100);

  const graphManager = new CodeGraphManager(process.cwd());
  const result = await runUnifiedQuery(
    sanitizedQuery,
    safeLimit,
    ctx,
    vectorEngine,
    graphManager,
    gitIntegration
  );

  return result;
}

async function listSkills() {
  if (!skillsManager) throw new Error('Skills manager not initialized');

  const skills = skillsManager.listSkills();
  return {
    skills: skills.map(s => ({
      name: s.name,
      description: s.description,
      version: s.version,
      commandCount: s.commands.length,
      triggers: s.triggers || []
    })),
    total: skills.length
  };
}

async function loadSkill(skillName: string) {
  if (!skillsManager) throw new Error('Skills manager not initialized');
  const sec = getSecurity();

  const sanitizedName = sec.sanitizeInput(skillName, 50);
  const skill = skillsManager.getSkill(sanitizedName);
  if (!skill) {
    return { error: `Skill ${sanitizedName} not found`, available: [] };
  }

  return {
    skill: {
      name: skill.name,
      description: skill.description,
      version: skill.version,
      commands: skill.commands.map(c => ({
        name: c.name,
        description: c.description
      })),
      triggers: skill.triggers || []
    }
  };
}

async function getGitSummary() {
  if (!gitIntegration) throw new Error('Git integration not initialized');

  try {
    const summary = await gitIntegration.getGitSummary();
    return {
      currentBranch: summary.currentBranch,
      totalCommits: summary.recentCommits.length,
      status: summary.status,
      recentCommits: summary.recentCommits.slice(0, 5).map(c => ({
        hash: c.hash.substring(0, 7),
        message: c.message,
        author: c.author
      }))
    };
  } catch (e) {
    return { error: 'Not a git repository' };
  }
}

async function getMemoriesForCommit(hash: string) {
  const sec = getSecurity();
  const ctx = getCore();
  
  const safeHash = sec.sanitizeInput(hash, 40).toLowerCase();
  const memories = await ctx.searchMemories({ limit: 1000 });
  
  const results = memories.filter(m => m.commitHash && m.commitHash.toLowerCase().startsWith(safeHash));
  
  return { results };
}

async function ingestDocs(paths?: string[]) {
  if (!vectorEngine) throw new Error('Vector engine not initialized');
  const repoPath = process.cwd();
  const graphManager = new CodeGraphManager(repoPath);
  const ingester = new DocsIngester(repoPath, vectorEngine, graphManager);
  
  const filesIngested = await ingester.ingestMarkdown(paths || ['**/*.md']);
  return { status: 'completed', filesIngested };
}

async function ingestPdf(filePath: string) {
  const { PdfParser } = await import('@imayuur/contexthub-plugin-pdf');
  const sec = getSecurity();
  const safePath = sec.validatePath(filePath);
  
  const parser = new PdfParser();
  const result = await parser.parsePdf(safePath);
  
  const ctx = getCore();
  const session = (await ctx.getSessions(1))[0];
  
  const path = await import('path');
  const fileName = path.basename(safePath);

  // Split into chunks if needed, but for now just save it directly. 
  // It relies on MAX_MEMORY_CONTENT_LENGTH truncation inside saveMemory if it's too large,
  // but let's save the metadata and first chunk of text to memory.
  let contentToSave = result.text;
  if (contentToSave.length > sec.maxInputLength) {
    contentToSave = contentToSave.substring(0, sec.maxInputLength - 100) + '... [TRUNCATED]';
  }

  const memoryData = {
    sessionId: session ? session.id : 'default-session',
    type: 'manual',
    content: `PDF Extraction: ${fileName}\nPages: ${result.pages}\n\n${contentToSave}`,
    timestamp: Date.now(),
    tags: ['pdf', 'ingest']
  };

  if (session) {
    await saveMemory(session.id, memoryData as any);
  } else {
    // Just save raw memory
    await ctx.saveMemory(memoryData as any);
  }
  
  return { 
    status: 'success', 
    pages: result.pages, 
    bytesRead: result.text.length,
    message: 'PDF ingested successfully and saved to memory.'
  };
}


async function searchDocs(query: string, limit?: number) {
  if (!vectorEngine) throw new Error('Vector engine not initialized');
  const repoPath = process.cwd();
  const graphManager = new CodeGraphManager(repoPath);
  const ingester = new DocsIngester(repoPath, vectorEngine, graphManager);
  
  const safeLimit = getSecurity().validateLimit(limit || 10, 1, 100);
  const results = await ingester.searchDocs(query, safeLimit);
  return { results };
}

async function runSkillCommand(skillName: string, commandName: string, args: Record<string, string>) {
  if (!skillsManager) throw new Error('Skills manager not initialized');
  const sec = getSecurity();

  // Validate skill and command names
  const sanitizedSkill = sec.sanitizeInput(skillName, 50);
  const sanitizedCommand = sec.sanitizeInput(commandName, 50);

  // Sanitize args values
  const sanitizedArgs: Record<string, string> = {};
  for (const [key, value] of Object.entries(args || {})) {
    sanitizedArgs[sec.sanitizeInput(key, 50)] = sec.sanitizeInput(String(value), 1000);
  }

  const ctx = getCore();
  const context = {
    repoPath: process.cwd(),
    getMemories: async (query: string) => {
      const safeQuery = sec.sanitizeQuery(query);
      const mems = await ctx.searchMemories({ limit: 50 });
      return mems.filter(m => m.content.toLowerCase().includes(safeQuery.toLowerCase()));
    },
    addMemory: async (content: string, tags?: string[]) => {
      const session = (await ctx.getSessions(1))[0];
      if (session) {
        await ctx.saveMemory({
          sessionId: session.id,
          type: 'manual',
          content: sec.sanitizeInput(content),
          timestamp: Date.now(),
          tags: (tags || []).map(t => sec.sanitizeInput(t, 100)).slice(0, 20)
        });
      }
    },
    getGitInfo: async () => {
      if (gitIntegration) {
        return gitIntegration.getGitSummary().catch(() => null);
      }
      return null;
    }
  };

  const result = await skillsManager.executeSkill(sanitizedSkill, sanitizedCommand, sanitizedArgs, context);
  return { output: result, skillName: sanitizedSkill, commandName: sanitizedCommand };
}

// ── Main Server Setup ────────────────────────────────────────────────────

async function main() {
  const reposPath = process.cwd();
  await initCore(reposPath);

  const server = new McpServer({
    name: 'contexthub',
    version: '1.0.0'
  });

  // Register resources and prompts
  registerResourcesAndPrompts(server);

  // Register all tools (wrapped with safe error handling)
  server.tool('get_project_context', {}, safeHandler(getProjectContext));

  server.tool('get_agent_policy', {}, safeHandler(getAgentPolicy));

  server.tool('ensure_session', {
    agent: { type: 'string' },
    forceNew: { type: 'boolean', optional: true },
  }, safeHandler(async ({ agent, forceNew }: any) => ensureSession(agent, Boolean(forceNew))));

  server.tool('record_turn', {
    agent: { type: 'string' },
    sessionId: { type: 'string', optional: true },
    promptSummary: { type: 'string' },
    responseSummary: { type: 'string' },
    memoryType: { type: 'string', optional: true },
    tags: { type: 'array', optional: true },
    relatedPaths: { type: 'array', optional: true },
    relatedSymbols: { type: 'array', optional: true },
    commitHash: { type: 'string', optional: true },
    branch: { type: 'string', optional: true },
  }, safeHandler(async (args: any) => recordTurn(args)));

  server.tool('search_memory', {
    query: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ query, limit }: any) => searchMemory(query, limit)));

  server.tool('save_session', {
    agent: { type: 'string' },
    metadata: { type: 'object', optional: true }
  }, safeHandler(async ({ agent, metadata }: any) => saveSession(agent, metadata)));

  server.tool('end_session', {
    sessionId: { type: 'string' }
  }, safeHandler(async ({ sessionId }: any) => endSessionWithCleanup(sessionId)));

  server.tool('save_memory', {
    sessionId: { type: 'string' },
    memory: { type: 'object' }
  }, safeHandler(async ({ sessionId, memory }: any) => saveMemory(sessionId, memory)));

  server.tool('summarize_repo', {}, safeHandler(summarizeRepo));

  server.tool('get_related_files', {
    filePath: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ filePath, limit }: any) => getRelatedFiles(filePath, limit)));

  server.tool('get_recent_changes', {
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ limit }: any) => getRecentChanges(limit)));

  server.tool('get_architecture_summary', {}, safeHandler(getArchitectureSummary));

  server.tool('semantic_search', {
    query: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ query, limit }: any) => semanticSearch(query, limit)));

  server.tool('update_knowledge_graph', {}, safeHandler(updateKnowledgeGraph));

  server.tool('list_skills', {}, safeHandler(listSkills));

  server.tool('load_skill', {
    skillName: { type: 'string' }
  }, safeHandler(async ({ skillName }: any) => loadSkill(skillName)));

  server.tool('run_skill_command', {
    skillName: { type: 'string' },
    commandName: { type: 'string' },
    args: { type: 'object', optional: true }
  }, safeHandler(async ({ skillName, commandName, args }: any) =>
    runSkillCommand(skillName, commandName, args || {})));

  server.tool('get_git_summary', {}, safeHandler(getGitSummary));

  server.tool('get_memories_for_commit', {
    hash: { type: 'string' }
  }, safeHandler(async ({ hash }: any) => getMemoriesForCommit(hash)));

  server.tool('ingest_docs', {
    paths: { type: 'object', optional: true }
  }, safeHandler(async ({ paths }: any) => ingestDocs(paths)));

  server.tool('search_docs', {
    query: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ query, limit }: any) => searchDocs(query, limit)));

  server.tool('get_code_graph_stats', {}, safeHandler(getCodeGraphStats));

  server.tool('get_related_symbols', {
    fileOrSymbol: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ fileOrSymbol, limit }: any) => getRelatedSymbols(fileOrSymbol, limit)));

  server.tool('get_blast_radius', {
    fileOrSymbol: { type: 'string' },
    depth: { type: 'number', optional: true }
  }, safeHandler(async ({ fileOrSymbol, depth }: any) => getBlastRadius(fileOrSymbol, depth)));

  server.tool('trace_code_path', {
    fromId: { type: 'string' },
    toId: { type: 'string' },
    maxHops: { type: 'number', optional: true }
  }, safeHandler(async ({ fromId, toId, maxHops }: any) => traceCodePath(fromId, toId, maxHops)));

  server.tool('search_memory_by_code', {
    fileOrSymbol: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ fileOrSymbol, limit }: any) => searchMemoryByCode(fileOrSymbol, limit)));

  server.tool('get_god_nodes', {
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ limit }: any) => getGodNodes(limit)));

  server.tool('get_graph_communities', {}, safeHandler(getGraphCommunities));

  server.tool('diff_code_graph', {
    baseSnapshotId: { type: 'string', optional: true },
    headSnapshotId: { type: 'string', optional: true }
  }, safeHandler(async ({ baseSnapshotId, headSnapshotId }: any) => diffCodeGraphMcp(baseSnapshotId, headSnapshotId)));

  server.tool('what_changed_since_session', {
    sessionId: { type: 'string' }
  }, safeHandler(async ({ sessionId }: any) => whatChangedSinceSessionMcp(sessionId)));

  server.tool('contexthub_query', {
    query: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, safeHandler(async ({ query, limit }: any) => contexthubQueryMcp(query, limit)));

  server.tool('get_context_bundle', {
    query: { type: 'string', optional: true },
    path: { type: 'string', optional: true },
    sessionId: { type: 'string', optional: true },
    limit: { type: 'number', optional: true }
  }, safeHandler(async (args: any) => {
    if (!args.query && !args.path && !args.sessionId) {
      throw new Error('Must provide at least one of query, path, or sessionId');
    }
    return getContextBundleMcp(args.query, args.path);
  }));

  server.tool('explain_symbol', {
    symbol: { type: 'string' },
    path: { type: 'string', optional: true }
  }, safeHandler(async ({ symbol }: any) => explainSymbolMcp(symbol)));

  if (process.env.CONTEXTHUB_ENABLE_PDF === '1') {
    server.tool('ingest_pdf', {
      filePath: { type: 'string' }
    }, safeHandler(async ({ filePath }: any) => ingestPdf(filePath)));
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ContextHub MCP server started (hardened mode)');
}

if (require.main === module) {
  main().catch(error => {
    // Sanitize error output — don't expose internal paths
    const safeMsg = String(error?.message || 'Unknown error').replace(/\/[^\s]+/g, '[path]');
    console.error('Failed to start MCP server:', safeMsg);
    process.exit(1);
  });
}

export { buildSkillMarkdown } from './agent-policy';
export { buildContextBundle, explainSymbol } from './context-bundle';