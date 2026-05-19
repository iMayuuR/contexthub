import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
} from 'fs';
import { join } from 'path';
import type { SecurityManager } from '@contexthub/core';
import {
  AGENT_POLICY_MARKER,
  buildAgentsMdSection,
  buildCanonicalPolicy,
  buildClaudeMdSection,
  buildCursorRule,
} from './policy';

function templatesDir(): string {
  return join(__dirname, '..', 'templates');
}

export interface InstallResult {
  cursorRule: boolean;
  cursorMcp: boolean;
  cursorHooks: boolean;
  agentsMd: boolean;
  claudeMd: boolean;
  canonicalPolicy: boolean;
}

function mergeHooksJson(hooksPath: string, hookRelPath: string): void {
  const contexthubStop = {
    command: hookRelPath,
  };
  const contexthubSessionEnd = {
    command: hookRelPath,
  };

  let config: { version: number; hooks: Record<string, unknown[]> } = {
    version: 1,
    hooks: {},
  };

  if (existsSync(hooksPath)) {
    try {
      config = JSON.parse(readFileSync(hooksPath, 'utf8'));
      if (!config.hooks) config.hooks = {};
    } catch {
      config = { version: 1, hooks: {} };
    }
  }

  const addUnique = (key: string, entry: { command: string }) => {
    const list = (config.hooks[key] as { command: string }[]) || [];
    if (!list.some((h) => h.command === entry.command)) {
      list.push(entry);
    }
    config.hooks[key] = list;
  };

  addUnique('stop', contexthubStop);
  addUnique('sessionEnd', contexthubSessionEnd);

  writeFileSync(hooksPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function mergeMarkdownSection(filePath: string, section: string): void {
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8');
    if (existing.includes(AGENT_POLICY_MARKER)) return;
    writeFileSync(filePath, existing.trimEnd() + '\n\n' + section, 'utf8');
  } else {
    writeFileSync(filePath, section.trim() + '\n', 'utf8');
  }
}

function writeCursorMcp(mcpPath: string): void {
  const contexthubServer = {
    command: 'npx',
    args: ['-y', '@contexthub/cli', 'start'],
  };

  let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
  if (existsSync(mcpPath)) {
    try {
      config = JSON.parse(readFileSync(mcpPath, 'utf8'));
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      config = { mcpServers: {} };
    }
  }

  if (!config.mcpServers!.contexthub) {
    config.mcpServers!.contexthub = contexthubServer;
  }

  writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Install agent rules, MCP config template, and Cursor hooks for secure auto-memory.
 */
export function installAgentIntegrations(
  repoPath: string,
  security: SecurityManager
): InstallResult {
  const result: InstallResult = {
    cursorRule: false,
    cursorMcp: false,
    cursorHooks: false,
    agentsMd: false,
    claudeMd: false,
    canonicalPolicy: false,
  };

  const contexthubDir = join(repoPath, '.contexthub');
  if (!existsSync(contexthubDir)) {
    mkdirSync(contexthubDir, { recursive: true });
    security.setSecurePermissions(contexthubDir, true);
  }

  const policyPath = join(contexthubDir, 'agent-policy.md');
  writeFileSync(policyPath, buildCanonicalPolicy(), 'utf8');
  security.setSecurePermissions(policyPath);
  result.canonicalPolicy = true;

  // Cursor rule
  const cursorRulesDir = join(repoPath, '.cursor', 'rules');
  mkdirSync(cursorRulesDir, { recursive: true });
  const rulePath = join(cursorRulesDir, 'contexthub-auto-memory.mdc');
  writeFileSync(rulePath, buildCursorRule(), 'utf8');
  result.cursorRule = true;

  // Cursor MCP (no secrets in file — start loads .auth-token)
  const cursorDir = join(repoPath, '.cursor');
  mkdirSync(cursorDir, { recursive: true });
  writeCursorMcp(join(cursorDir, 'mcp.json'));
  result.cursorMcp = true;

  // Cursor hooks
  const hooksDir = join(cursorDir, 'hooks');
  mkdirSync(hooksDir, { recursive: true });
  const hookSrc = join(templatesDir(), 'record-turn-hook.mjs');
  const hookDest = join(hooksDir, 'contexthub-record-turn.mjs');
  if (existsSync(hookSrc)) {
    copyFileSync(hookSrc, hookDest);
    chmodSync(hookDest, 0o755);
    mergeHooksJson(join(cursorDir, 'hooks.json'), '.cursor/hooks/contexthub-record-turn.mjs');
    result.cursorHooks = true;
  }

  // Universal agents
  mergeMarkdownSection(join(repoPath, 'AGENTS.md'), buildAgentsMdSection());
  result.agentsMd = true;

  mergeMarkdownSection(join(repoPath, 'CLAUDE.md'), buildClaudeMdSection());
  result.claudeMd = true;

  return result;
}
