export const AGENT_POLICY_VERSION = '1.0.0';

export function getAgentPolicyMarkdown(): string {
  return `# ContextHub — Secure Auto-Memory Policy

You are connected to **ContextHub** (local MCP server). The user expects memory to be handled automatically — they should not need to remind you.

## Required workflow (every session)

1. **Session start** — Call \`ensure_session\` with your agent name (e.g. \`cursor\`, \`claude-code\`, \`windsurf\`, \`copilot\`, \`codex\`).
2. **Before answering** — Call \`get_project_context\` and optionally \`search_memory\` / \`semantic_search\` for relevant past context.
3. **After each meaningful turn** — Call \`record_turn\` with a concise prompt summary and your response summary (decisions, bugs, architecture, file paths).
4. **Session end** — Call \`end_session\` with the session id from \`ensure_session\`.

## When to call \`record_turn\` (automatic — do not ask the user)

- Architectural or design decisions
- Bug root cause and fix
- Non-obvious repo conventions discovered
- Security-relevant behavior
- Breaking changes or migration notes

Skip: trivial chit-chat, pure formatting, repeated info already saved.

## Security rules (mandatory)

- **Never** read or output \`.contexthub/.keyfile\`
- **Never** store raw API keys, passwords, tokens, or private keys — ContextHub redacts, but you must omit secrets from \`record_turn\` content
- **Never** scan \`.env\`, \`.pem\`, \`.key\`, \`id_rsa\` files
- Only use repo-relative paths in memories
- Do not modify shell profiles or install surveillance hooks

## Tool preference

| Goal | Tool |
|------|------|
| Start / resume session | \`ensure_session\` |
| Save user + assistant turn | \`record_turn\` |
| Single fact | \`save_memory\` |
| Find past context | \`search_memory\`, \`semantic_search\` |
| Repo overview | \`get_project_context\`, \`get_architecture_summary\` |

Policy version: ${AGENT_POLICY_VERSION}
`;
}

export function buildSkillMarkdown(): string {
  return `---
# ContextHub Skill
description: Integrates ContextHub local-first MCP server for memory and knowledge graph access.
---

<!-- contexthub:managed -->

${getAgentPolicyMarkdown()}
`;
}
