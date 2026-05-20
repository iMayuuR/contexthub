# ContextHub - Development Guide

## Project Overview

ContextHub is a **persistent AI memory and context orchestration layer** for coding agents. It provides automatic context injection, semantic memory search, and repository intelligence for AI coding assistants like Claude Code, Cursor, Windsurf, and any MCP-compatible agent.

> **Security Note:** This codebase has been security-hardened. All data is encrypted at rest (AES-256-GCM), all inputs are validated, and sensitive data is auto-redacted. See `SECURITY.md` for the full audit report (26 findings, all fixed, 38/38 tests passing).

### Architecture

```
contexthub/
├── packages/
│   ├── shared-types/      # TypeScript interfaces (Session, MemoryEntry, CodeGraph)
│   ├── core/              # Core engine: storage, security, RRF query, config, limits
│   │   ├── security.ts    # 🔒 SecurityManager (AES-256-GCM, validation, redaction)
│   │   ├── memory-storage.ts # Encrypted JSON storage with mutex + atomic writes
│   │   ├── contexthub-ignore.ts # .contexthubignore file support
│   │   └── index.ts       # ContextHubCore facade
│   ├── cli/               # Command-line interface (25 commands)
│   │   ├── setup.ts       # Secure init (no shell hooks, PID management)
│   │   ├── start.ts       # Server start with port validation + PID file
│   │   ├── stop.ts        # Clean shutdown via SIGTERM/SIGKILL
│   │   ├── dashboard.ts   # Interactive web dashboard (Vis.js topology graph)
│   │   ├── watch.ts       # Incremental file watcher (graph + embeddings)
│   │   ├── query.ts       # Unified RRF query (memory + graph + git)
│   │   └── index.ts       # Commander setup with error sanitization
│   ├── mcp-server/        # MCP server (35+ tools, hardened with safeHandler)
│   ├── knowledge-graph/   # Code graph: build/patch, god-nodes, communities, reports
│   ├── vector-engine/     # Embeddings: local bigram TF-IDF, optional transformers
│   ├── repo-parser/       # Code analysis: Tree-sitter (TS/JS/TSX/Py) + regex 15+ langs
│   ├── git-integration/   # Git history: simple-git wrapper
│   ├── docs-ingest/       # Markdown chunk + embed into vector engine
│   ├── plugin-pdf/        # PDF parse (CONTEXTHUB_ENABLE_PDF=1)
│   ├── memory-engine/     # Advanced memory algorithms (compact, archive, dedup)
│   ├── context-injector/  # Smart context retrieval and prompt enhancement
│   ├── agent-connectors/  # AI agent adapters (with safeSaveMemory)
│   └── skills/            # Built-in skills only: architect, debug, review (allowlist)
├── scripts/
│   ├── publish-packages.js  # Publish all packages to npm in dependency order
│   └── rename-scope.js     # Rename package scope (e.g. @contexthub → @imayuur)
├── docs/                  # Marketing site, assets
├── SECURITY.md            # 🔒 Full security scan report
└── .contexthub/           # Per-repo encrypted storage (created at runtime)
```

## Development Commands

```bash
# Install dependencies
npm install

# Build all packages (in dependency order)
npm run build

# Run all tests (38 tests across 4 packages)
npm test

# Initialize ContextHub in a repo
node packages/cli/dist/index.js setup

# Run memory operations
node packages/cli/dist/index.js memory --list
node packages/cli/dist/index.js memory --add "Note here"

# Start MCP server
node packages/cli/dist/index.js start --port 3000

# Stop MCP server cleanly
node packages/cli/dist/index.js stop

# Launch interactive dashboard
node packages/cli/dist/index.js dashboard --port 3847

# Unified query (RRF: memory + graph + git)
node packages/cli/dist/index.js query "auth race condition"

# Watch files for incremental graph updates
node packages/cli/dist/index.js watch

# Run diagnostics
node packages/cli/dist/index.js doctor

# Performance benchmarks
node packages/cli/dist/index.js benchmark

# DeepSync — one-command repo intelligence
node packages/cli/dist/index.js deepsync
node packages/cli/dist/index.js deepsync --force

# --- Publishing to NPM ---
# Rename packages scope to your custom org/user (e.g. @imayuur)
npm run rename-scope @imayuur

# Publish all packages to npm in order
npm run publish:packages
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
- `runUnifiedQuery()` — RRF hybrid query merging semantic, keyword, graph, and git results
- `loadConfig()` — Load `contexthub.config.js` for multi-root workspace support

### CLI Package (`packages/cli`)

25 commands:
- `init` / `setup` / `start` / `stop` — Lifecycle + agent files + skill install
- `memory` / `timeline` / `search` — Memory operations
- `watch [path]` — Incremental graph + embeddings + md ingest
- `query` / `context` — Unified RRF query / context bundle generation
- `deepsync` — 🧠 One-command repo intelligence (code + docs + git → knowledge graph)
- `dashboard` — Interactive web UI with Vis.js topology graph
- `export-graph` / `report` — Graph export and GRAPH_REPORT.md
- `ingest-docs` — Markdown documentation ingest
- `doctor` / `status` / `benchmark` — Health, status, and performance
- `compact --archive-age N` — Merge pairs + optional archive
- `export-memories` — Encrypted portable bundle (.chub)
- `ci` / `blast-radius` — CI diagnostics and PR impact analysis

### MCP Server (`packages/mcp-server`)

35+ tools registered, all wrapped with `safeHandler()` for error sanitization:

**Session & Memory:** `ensure_session`, `record_turn`, `save_session`, `end_session`, `get_project_context`, `save_memory`, `search_memory`, `semantic_search`, `search_memory_by_code`, `contexthub_query`, `get_context_bundle`, `explain_symbol`

**Graph:** `get_code_graph_stats`, `get_related_symbols`, `get_blast_radius`, `trace_code_path`, `update_knowledge_graph`, `get_god_nodes`, `get_graph_communities`, `diff_code_graph`, `what_changed_since_session`

**Repo & Git:** `summarize_repo`, `get_architecture_summary`, `get_related_files`, `get_recent_changes`, `get_git_summary`, `get_memories_for_commit`

**Docs & Skills:** `ingest_docs`, `search_docs`, `ingest_pdf`, `list_skills`, `load_skill`, `run_skill_command`

**Resources:** `contexthub://policy`, `contexthub://graph-stats`, `contexthub://report`
**Prompts:** `summarize-session`, `onboard-repo`, `pre-commit-review`

### Knowledge Graph (`packages/knowledge-graph`)

- Multi-root support via `contexthub.config.js` → prefixed node ids (`pkg:…#path`)
- God-node detection (high-degree transitive hubs)
- Community detection (connected components)
- Snapshot diffing across sessions
- `GRAPH_REPORT.md` generation with dependency analysis

### Repo Parser (`packages/repo-parser`)

- **Tree-sitter WASM:** TypeScript, JavaScript, TSX, Python (5s timeout, regex fallback)
- **Regex parsers:** Go, Rust, Java, Ruby, PHP, C#, Swift, Kotlin, Scala, C/C++
- Fixtures + tests for each language under `packages/repo-parser/fixtures/`

### Shared Types (`packages/shared-types`)

- `Session` — Agent session with timing and metadata
- `MemoryEntry` — Memory with type union: `prompt | response | summary | decision | architecture | bugfix | manual | commit`
- `CodeGraph` — Graph data structure with nodes and edges
- `ProjectMetadata` — Project info (name, language, framework, timestamps)
- `VectorSearchResult` — Search result with id, score, and memory metadata
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
# Expected: 38/38 tests passed across cli, core, knowledge-graph, repo-parser
```

## Performance Benchmarks

| Metric | Value |
|--------|-------|
| Context Bundle Latency | **302ms** |
| Graph Build Time | 3.37s (192 files) |
| Memory Search | <2ms |
| Vector Search | <7ms |
| Watch Mode Patch | <50ms |

Run `contexthub benchmark` to generate fresh numbers for your machine.

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
| Context bundle | `get_context_bundle` |
| Find context | `search_memory`, `semantic_search` |
| Code graph stats | `get_code_graph_stats` |
| Related symbols | `get_related_symbols` |
| Blast radius | `get_blast_radius` |
| Trace path | `trace_code_path` |
| Search by code | `search_memory_by_code` |
| Full policy text | `get_agent_policy` |

## 🧠 DeepSync — Instant Repo Intelligence

Run `npx @imayuur/contexthub deepsync` once to build a complete knowledge graph of your codebase — code, docs, and git history. After that, context **auto-updates every session** via `ensure_session`. No manual effort needed.

```bash
npx @imayuur/contexthub deepsync
```

Connect MCP: `npx @imayuur/contexthub start` with `CONTEXTHUB_TOKEN` from `.contexthub/.auth-token` (do not commit the token).
