export const AGENT_POLICY_MARKER = '<!-- contexthub:auto-memory -->';

export function buildCanonicalPolicy(): string {
  return `# ContextHub — Secure Auto-Memory Policy

ContextHub stores **encrypted** project memory locally (AES-256-GCM). Agents must use MCP tools — no shell logging or shell profile changes.

## Required workflow (every session)

1. **Session start** — \`ensure_session\` with agent name: \`cursor\`, \`claude-code\`, \`windsurf\`, \`copilot\`, \`codex\`, or your client id.
2. **Before answering** — \`get_project_context\`; use \`search_memory\` / \`semantic_search\` when prior context may help.
3. **After each meaningful turn** — \`record_turn\` with concise prompt + response summaries (decisions, bugs, architecture).
4. **Session end** — \`end_session\` with the active session id.

## When to call \`record_turn\` automatically (do not ask the user)

- Architectural or design decisions
- Bug root cause and fix
- Non-obvious repo conventions
- Security-relevant behavior
- Breaking changes

Skip: small talk, pure formatting, duplicate facts already stored.

## Security (mandatory)

- Never read or output \`.contexthub/.keyfile\`
- Never store API keys, passwords, tokens, or private keys
- Never scan \`.env\`, \`.pem\`, \`.key\`, \`id_rsa\` for memory content
- Use repo-relative paths only

## Tool cheat sheet

| Goal | Tool |
|------|------|
| Start session | \`ensure_session\` |
| Save a turn | \`record_turn\` |
| Single note | \`save_memory\` |
| Unified query | \`contexthub_query\` |
| Find context | \`search_memory\`, \`semantic_search\` |
| Code graph stats | \`get_code_graph_stats\` |
| Related symbols | \`get_related_symbols\` |
| Blast radius | \`get_blast_radius\` |
| Trace path | \`trace_code_path\` |
| Search by code | \`search_memory_by_code\` |
| Full policy text | \`get_agent_policy\` |
`;
}

export function buildCursorRule(): string {
  return `---
description: ContextHub secure auto-memory — MCP tools required
globs:
alwaysApply: true
---

${buildCanonicalPolicy()}

## Cursor-specific

- ContextHub MCP must be enabled (see \`.cursor/mcp.json\`).
- Prefer \`record_turn\` over manual \`save_memory\` for conversation turns.
- On architectural decisions and bugfixes, always \`record_turn\` before finishing the reply.
`;
}

export function buildAgentsMdSection(): string {
  return `${AGENT_POLICY_MARKER}

## ContextHub (all agents)

${buildCanonicalPolicy()}

Supported: **Cursor**, **Claude Code**, **Windsurf**, **GitHub Copilot**, **Codex**, and any **MCP** client using \`npx @contexthub/cli start\`.

`;
}

export function buildClaudeMdSection(): string {
  return `${AGENT_POLICY_MARKER}

# ContextHub MCP — auto-memory

${buildCanonicalPolicy()}

Connect MCP: \`npx @contexthub/cli start\` with \`CONTEXTHUB_TOKEN\` from \`.contexthub/.auth-token\` (do not commit the token).

`;
}
