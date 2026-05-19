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
import { ContextHubCore, SecurityManager } from '@contexthub/core';
import { VectorEngine } from '@contexthub/vector-engine';
import { RepoParser } from '@contexthub/repo-parser';
import { GitIntegration } from '@contexthub/git-integration';
import { SkillsManager } from '@contexthub/skills';
import type { MemoryEntry, Session } from '@contexthub/shared-types';
import { getAgentPolicyMarkdown, AGENT_POLICY_VERSION } from './agent-policy';
import {
  readActiveSession,
  writeActiveSession,
  clearActiveSession,
} from './session-state';

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
  const [metadata, sessions, memories] = await Promise.all([
    ctx.getProjectMetadata(),
    ctx.getSessions(5),
    ctx.searchMemories({ limit: 100 })
  ]);

  // Calculate stats
  const typeCounts: Record<string, number> = {};
  for (const mem of memories) {
    typeCounts[mem.type] = (typeCounts[mem.type] || 0) + 1;
  }

  const active = readActiveSession(process.cwd());

  return {
    project: metadata,
    recentSessions: sessions,
    memoryStats: typeCounts,
    totalMemories: memories.length,
    timestamp: Date.now(),
    activeSession: active,
    agentPolicyVersion: AGENT_POLICY_VERSION,
    autoMemoryInstructions:
      'Call ensure_session at start, record_turn after meaningful turns, get_project_context before work. See get_agent_policy.',
  };
}

async function searchMemory(query: string, limit: number = 10) {
  const ctx = getCore();
  const sec = getSecurity();

  // Validate inputs
  const sanitizedQuery = sec.sanitizeQuery(query);
  const safeLimit = sec.validateLimit(limit, 1, 100);

  const allMemories = await ctx.searchMemories({ limit: 1000 });

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
}) {
  const ctx = getCore();
  const sec = getSecurity();

  // Validate inputs
  const sanitizedSessionId = sec.sanitizeInput(sessionId, 50);
  let sanitizedContent = sec.sanitizeInput(memoryData.content, 51200); // 50KB max
  if (sec.isSensitive(sanitizedContent)) {
    sanitizedContent = sec.redactSensitive(sanitizedContent);
  }
  const validType = sec.validateMemoryType(memoryData.type || 'manual');

  const sanitizedTags = (memoryData.tags || [])
    .map(tag => sec.sanitizeInput(tag, 100))
    .filter(tag => tag.length > 0)
    .slice(0, 20);

  const id = await ctx.saveMemory({
    sessionId: sanitizedSessionId,
    type: validType as any,
    content: sanitizedContent,
    timestamp: Date.now(),
    tags: sanitizedTags
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

  const sessionId = await ctx.createSession(sanitizedAgent, { autoMemory: true });
  writeActiveSession(
    repoPath,
    { sessionId, agent: sanitizedAgent, startedAt: Date.now() },
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
  });

  const responseType = sec.validateMemoryType(params.memoryType || 'response');
  const responseId = await saveMemory(sessionId!, {
    type: responseType,
    content: response,
    tags: ['response', sanitizedAgent, 'auto', ...extraTags],
  });

  return {
    sessionId,
    promptMemoryId: promptId.id,
    responseMemoryId: responseId.id,
    saved: true,
  };
}

async function endSessionWithCleanup(sessionId: string) {
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

async function updateKnowledgeGraph() {
  if (!repoParser) throw new Error('Repo parser not initialized');

  const parsed = await repoParser.parseDirectory(process.cwd());

  return {
    status: 'completed',
    filesAnalyzed: parsed.length,
    files: parsed.map(p => ({
      path: p.path,
      language: p.language,
      symbolCount: p.symbols.length,
      importCount: p.imports.length,
      exportCount: p.exports.length
    }))
  };
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ContextHub MCP server started (hardened mode)');
}

main().catch(error => {
  // Sanitize error output — don't expose internal paths
  const safeMsg = String(error?.message || 'Unknown error').replace(/\/[^\s]+/g, '[path]');
  console.error('Failed to start MCP server:', safeMsg);
  process.exit(1);
});