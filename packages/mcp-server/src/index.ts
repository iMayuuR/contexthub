// @ts-ignore
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
// @ts-ignore
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
import { ContextHubCore } from '@contexthub/core';
import { VectorEngine } from '@contexthub/vector-engine';
import { RepoParser } from '@contexthub/repo-parser';
import { GitIntegration } from '@contexthub/git-integration';
import { SkillsManager } from '@contexthub/skills';
import type { MemoryEntry, Session } from '@contexthub/shared-types';

let core: ContextHubCore | null = null;
let vectorEngine: VectorEngine | null = null;
let repoParser: RepoParser | null = null;
let gitIntegration: GitIntegration | null = null;
let skillsManager: SkillsManager | null = null;

async function initCore(repoPath: string): Promise<ContextHubCore> {
  if (core) return core;
  core = new ContextHubCore(repoPath);
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

// Tools

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

  return {
    project: metadata,
    recentSessions: sessions,
    memoryStats: typeCounts,
    totalMemories: memories.length,
    timestamp: Date.now()
  };
}

async function searchMemory(query: string, limit: number = 10) {
  const ctx = getCore();
  const allMemories = await ctx.searchMemories({ limit: 1000 });

  // Filter by content match
  const queryLower = query.toLowerCase();
  const filtered = allMemories.filter(mem =>
    mem.content.toLowerCase().includes(queryLower) ||
    mem.tags.some(tag => tag.toLowerCase().includes(queryLower))
  ).slice(0, limit);

  return {
    results: filtered,
    count: filtered.length,
    query
  };
}

async function saveSession(agent: string, metadata?: Record<string, any>) {
  const ctx = getCore();
  const sessionId = await ctx.createSession(agent, metadata || {});
  return { sessionId, agent, metadata };
}

async function endSession(sessionId: string) {
  const ctx = getCore();
  await ctx.endSession(sessionId);
  return { sessionId, ended: true };
}

async function saveMemory(sessionId: string, memoryData: {
  type?: string;
  content: string;
  tags?: string[];
}) {
  const ctx = getCore();
  const id = await ctx.saveMemory({
    sessionId,
    type: (memoryData.type as any) || 'manual',
    content: memoryData.content,
    timestamp: Date.now(),
    tags: memoryData.tags || []
  });
  return { id, sessionId };
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

  const ctx = getCore();
  const memories = await ctx.searchMemories({ limit: 100 });
  const parsed = await repoParser.parseDirectory(process.cwd());

  // Find files that import or reference this file
  const related: string[] = [];
  const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '');

  for (const pf of parsed) {
    if (pf.path === filePath) continue;
    for (const imp of pf.imports) {
      if (imp.source.includes(fileName || '') || imp.imported.some(i => i === fileName)) {
        related.push(pf.path);
        break;
      }
    }
  }

  return {
    targetFile: filePath,
    relatedFiles: related.slice(0, limit),
    totalRelated: related.length
  };
}

async function getRecentChanges(limit: number = 10) {
  if (!gitIntegration) throw new Error('Git integration not initialized');

  try {
    const summary = await gitIntegration.getGitSummary();
    return {
      currentBranch: summary.currentBranch,
      recentCommits: summary.recentCommits.slice(0, limit).map(c => ({
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
  const memories = await ctx.searchMemories({ limit: 500 });

  if (!vectorEngine) throw new Error('Vector engine not initialized');

  // Generate query embedding and search
  const results = await vectorEngine.searchSimilarText(query, memories, limit);

  return {
    query,
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

  const skill = skillsManager.getSkill(skillName);
  if (!skill) {
    return { error: `Skill ${skillName} not found`, available: [] };
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

  const ctx = getCore();
  const context = {
    repoPath: process.cwd(),
    getMemories: async (query: string) => {
      const mems = await ctx.searchMemories({ limit: 50 });
      return mems.filter(m => m.content.toLowerCase().includes(query.toLowerCase()));
    },
    addMemory: async (content: string, tags?: string[]) => {
      const session = (await ctx.getSessions(1))[0];
      if (session) {
        await ctx.saveMemory({
          sessionId: session.id,
          type: 'manual',
          content,
          timestamp: Date.now(),
          tags: tags || []
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

  const result = await skillsManager.executeSkill(skillName, commandName, args, context);
  return { output: result, skillName, commandName };
}

async function main() {
  const reposPath = process.cwd();
  await initCore(reposPath);

  const server = new McpServer({
    name: 'contexthub',
    version: '1.0.0'
  });

  // Register all tools
  server.tool('get_project_context', {}, getProjectContext);
  server.tool('search_memory', {
    query: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, async ({ query, limit }) => searchMemory(query, limit));

  server.tool('save_session', {
    agent: { type: 'string' },
    metadata: { type: 'object', optional: true }
  }, async ({ agent, metadata }) => saveSession(agent, metadata));

  server.tool('end_session', {
    sessionId: { type: 'string' }
  }, async ({ sessionId }) => endSession(sessionId));

  server.tool('save_memory', {
    sessionId: { type: 'string' },
    memory: { type: 'object' }
  }, async ({ sessionId, memory }) => saveMemory(sessionId, memory));

  server.tool('summarize_repo', {}, summarizeRepo);

  server.tool('get_related_files', {
    filePath: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, async ({ filePath, limit }) => getRelatedFiles(filePath, limit));

  server.tool('get_recent_changes', {
    limit: { type: 'number', optional: true }
  }, async ({ limit }) => getRecentChanges(limit));

  server.tool('get_architecture_summary', {}, getArchitectureSummary);

  server.tool('semantic_search', {
    query: { type: 'string' },
    limit: { type: 'number', optional: true }
  }, async ({ query, limit }) => semanticSearch(query, limit));

  server.tool('update_knowledge_graph', {}, updateKnowledgeGraph);

  server.tool('list_skills', {}, listSkills);

  server.tool('load_skill', {
    skillName: { type: 'string' }
  }, async ({ skillName }) => loadSkill(skillName));

  server.tool('run_skill_command', {
    skillName: { type: 'string' },
    commandName: { type: 'string' },
    args: { type: 'object', optional: true }
  }, async ({ skillName, commandName, args }) => runSkillCommand(skillName, commandName, args || {}));

  server.tool('get_git_summary', {}, getGitSummary);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ContextHub MCP server started');
}

main().catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});