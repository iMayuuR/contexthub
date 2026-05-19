# ContextHub - Development Guide

## Project Overview

ContextHub is a **persistent AI memory and context orchestration layer** for coding agents. It provides automatic context injection, semantic memory search, and repository intelligence for AI coding assistants like Claude Code, Cursor, and any MCP-compatible agent.

> **Security Note:** This codebase has been security-hardened. All data is encrypted at rest (AES-256-GCM), all inputs are validated, and sensitive data is auto-redacted. See `SECURITY.md` for the full audit report.

### Architecture

```
contexthub/
├── apps/
│   ├── web/              # Next.js dashboard (planned)
│   └── desktop/           # Electron app (planned)
├── packages/
│   ├── core/              # Core ContextHub engine
│   │   ├── security.ts    # 🔒 SecurityManager (encryption, validation, redaction)
│   │   ├── memory-storage.ts # Encrypted JSON storage with mutex + atomic writes
│   │   └── index.ts       # ContextHubCore facade
│   ├── cli/               # Command-line interface
│   │   ├── setup.ts       # Secure init (no shell hooks, PID management)
│   │   ├── start.ts       # Server start with port validation + PID file
│   │   ├── stop.ts        # Clean shutdown via SIGTERM/SIGKILL
│   │   └── index.ts       # Commander setup with error sanitization
│   ├── mcp-server/        # MCP server (hardened with safeHandler)
│   ├── shared-types/      # TypeScript interfaces (Session, MemoryEntry, etc.)
│   ├── memory-engine/     # Advanced memory algorithms
│   ├── vector-engine/     # Embeddings and similarity search (encrypted store)
│   ├── repo-parser/       # Code analysis (sandboxed: file limits, symlink check)
│   ├── context-injector/  # Context retrieval and prompt enhancement
│   ├── git-integration/   # Git history and commit tracking
│   ├── agent-connectors/  # Adapters for AI agents (with safeSaveMemory)
│   └── skills/            # Built-in skills only (no disk loading)
├── SECURITY.md            # Full security scan report
└── .contexthub/           # Per-repo encrypted storage (created at runtime)
```

## Development Commands

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Development mode
npm run dev

# Initialize ContextHub in a repo
node packages/cli/dist/index.js init

# Run memory operations
node packages/cli/dist/index.js memory --list
node packages/cli/dist/index.js memory --add "Note here"

# Setup with MCP server + encrypted storage
node packages/cli/dist/index.js setup

# Start MCP server
node packages/cli/dist/index.js start --port 3000

# Stop MCP server cleanly
node packages/cli/dist/index.js stop
```

## Key Components

### Core Package (`packages/core`)

- `ContextHubCore` — Main entry point (facade over MemoryStorage)
- `MemoryStorage` — Encrypted JSON file-based storage with:
  - AES-256-GCM encryption for all data at rest
  - Atomic writes (tmp file + rename) to prevent corruption
  - In-process `Mutex` for concurrent access safety
  - Auto-migration from plaintext to encrypted format
  - Entry count caps (10,000 max)
- `SecurityManager` — Centralized security module:
  - `encrypt()` / `decrypt()` — AES-256-GCM with IV + AuthTag
  - `sanitizeInput()` — Strip control chars, enforce max length
  - `validatePath()` — Prevent directory traversal
  - `isSensitive()` / `redactSensitive()` — Detect & redact secrets
  - `validatePort()`, `validateLimit()`, `validateMemoryType()` — Param validation
  - `generateAuthToken()` / `verifyAuthToken()` — HMAC-based auth
  - `isSensitiveFile()` — Block `.env`, `.pem`, `.key` from parsing

### CLI Package (`packages/cli`)

Commands:
- `init` — Initialize ContextHub in repository
- `setup` — Secure setup with encrypted storage + MCP server + auth token
- `memory` — Manage memories (--list, --add, --search, --type)
- `timeline` — View session timeline
- `search` — Semantic search across memories
- `start` — Start MCP server (port validation, PID file, graceful shutdown)
- `stop` — Stop MCP server cleanly via PID file

### MCP Server (`packages/mcp-server`)

All tools wrapped with `safeHandler()` for error sanitization:
- `get_project_context` — Get project metadata and recent sessions
- `search_memory` — Text search memories (query sanitized, limit bounded)
- `save_session` — Create new session (agent name sanitized)
- `end_session` — End active session
- `save_memory` — Store memory (content sanitized, type validated, tags capped)
- `summarize_repo` — Generate repo summary
- `get_related_files` — Find related files (path validated)
- `get_recent_changes` — Get git recent changes (limit bounded)
- `get_architecture_summary` — Analyze codebase structure
- `semantic_search` — Vector similarity search (query sanitized)
- `update_knowledge_graph` — Update code knowledge graph
- `list_skills` / `load_skill` — Skill management (name validated)
- `run_skill_command` — Execute skill (all args sanitized)
- `get_git_summary` — Git repository summary

### Shared Types (`packages/shared-types`)

- `Session` — Agent session with timing and metadata
- `MemoryEntry` — Memory with type union: `prompt | response | summary | decision | architecture | bugfix | manual | commit`
- `ProjectMetadata` — Project info (name, language, framework, timestamps)
- `VectorSearchResult` — Search result with id, score, and memory metadata
- `SecurityConfig` — Security configuration interface
- `VALID_MEMORY_TYPES` — Allowed memory type constants

### Skills Package (`packages/skills`)

**Security: No disk-based skill loading.** Only 3 built-in skills:
- `architect` — Analyze codebase architecture
- `debug` — Find similar past bugs
- `review` — Review recent code changes

Skill names validated against `ALLOWED_SKILL_NAMES` allowlist.

## Security Guidelines for Contributors

### When Adding MCP Tools

```typescript
// ALWAYS wrap handlers with safeHandler
server.tool('my_tool', {
  param: { type: 'string' }
}, safeHandler(async ({ param }: any) => {
  const sec = getSecurity();
  
  // ALWAYS validate/sanitize inputs
  const safeParam = sec.sanitizeInput(param, 100);
  
  // ALWAYS validate paths
  const safePath = sec.validatePath(filePath);
  
  // ALWAYS validate limits
  const safeLimit = sec.validateLimit(limit, 1, 100);
  
  return result;
}));
```

### When Saving Data

```typescript
// ALWAYS sanitize content before saving
let content = security.sanitizeInput(rawContent);

// ALWAYS check for sensitive data
if (security.isSensitive(content)) {
  content = security.redactSensitive(content);
}

// ALWAYS validate memory type
const type = security.validateMemoryType(rawType);
```

### When Reading Files

```typescript
// ALWAYS use lstatSync to detect symlinks (not statSync!)
const stats = fs.lstatSync(filePath);
if (stats.isSymbolicLink()) return; // Skip symlinks

// ALWAYS check file size
if (stats.size > MAX_FILE_SIZE) return; // Skip large files

// ALWAYS validate path within repo
security.validatePath(filePath);
```

## Adding Dependencies

When adding dependencies to packages:
```bash
cd packages/<package-name>
npm install <dependency>
```

Dependencies between local packages should use `file:../<package>` format in package.json.

## Adding New Commands

To add a new CLI command:
1. Create file in `packages/cli/src/commands/<command-name>.ts`
2. Export async function `commandName(options)`
3. Import in `packages/cli/src/index.ts`
4. Add command definition with commander
5. **Always** sanitize error output with `replace(/\/[^\s]+/g, '[path]')`

## Type Changes

When modifying shared types in `packages/shared-types/src/index.ts`:
1. Rebuild shared-types first: `npm run build --workspace=packages/shared-types`
2. Rebuild dependent packages
3. All consumers use `import type` for type-only imports to avoid runtime issues

## Testing

Run security verification tests:
```bash
npm run build
npm test
```

---

*Documentation for AI coding assistants — ContextHub v1.0.0 (Security Hardened)*

<!-- contexthub:auto-memory -->

# ContextHub MCP — auto-memory

# ContextHub — Secure Auto-Memory Policy

ContextHub stores **encrypted** project memory locally (AES-256-GCM). Agents must use MCP tools — no shell logging or shell profile changes.

## Required workflow (every session)

1. **Session start** — `ensure_session` with agent name: `cursor`, `claude-code`, `windsurf`, `copilot`, `codex`, or your client id.
2. **Before answering** — `get_project_context`; use `search_memory` / `semantic_search` when prior context may help.
3. **After each meaningful turn** — `record_turn` with concise prompt + response summaries (decisions, bugs, architecture).
4. **Session end** — `end_session` with the active session id.

## When to call `record_turn` automatically (do not ask the user)

- Architectural or design decisions
- Bug root cause and fix
- Non-obvious repo conventions
- Security-relevant behavior
- Breaking changes

Skip: small talk, pure formatting, duplicate facts already stored.

## Security (mandatory)

- Never read or output `.contexthub/.keyfile`
- Never store API keys, passwords, tokens, or private keys
- Never scan `.env`, `.pem`, `.key`, `id_rsa` for memory content
- Use repo-relative paths only

## Tool cheat sheet

| Goal | Tool |
|------|------|
| Start session | `ensure_session` |
| Save a turn | `record_turn` |
| Single note | `save_memory` |
| Unified query | `contexthub_query` |
| Find context | `search_memory`, `semantic_search` |
| Code graph stats | `get_code_graph_stats` |
| Related symbols | `get_related_symbols` |
| Blast radius | `get_blast_radius` |
| Trace path | `trace_code_path` |
| Search by code | `search_memory_by_code` |
| Full policy text | `get_agent_policy` |


Connect MCP: `npx @contexthub/cli start` with `CONTEXTHUB_TOKEN` from `.contexthub/.auth-token` (do not commit the token).

