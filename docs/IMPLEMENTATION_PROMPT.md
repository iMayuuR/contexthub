# ContextHub — Full Implementation Prompt (AI Agent)

> **Purpose:** Feed this document to any coding agent (Cursor, Claude Code, Codex, etc.) to implement the complete ContextHub roadmap while preserving security, MCP-first architecture, and existing conventions.
>
> **Product identity:** ContextHub is a **local-first MCP server** for **encrypted agent memory** + **code intelligence** — not a Graphify clone, not a life-logging tool, not shell surveillance.
>
> **Author:** Mayur Dattatray Patil · **License:** MIT

---

## Non-negotiable constraints (read first)

1. **MCP is the product surface** — agents connect via stdio; `@contexthub/cli` is only a launcher (`setup`, `start`, `stop`, `watch`, `query`).
2. **Security hardened** — follow `SECURITY.md` and `CLAUDE.md`:
   - All MCP tools wrapped in `safeHandler()`
   - `SecurityManager`: sanitize, validate paths, redact secrets, AES-256-GCM at rest
   - No shell profile hooks (`.bashrc`/`.zshrc`), no terminal command capture
   - No reading `.env`, `.pem`, `.key`, `id_rsa` for memory content
   - Never log or return `.contexthub/.keyfile` contents
3. **Local-first** — zero telemetry, no required cloud, no training on user data
4. **Monorepo** — TypeScript packages under `packages/*`, npm workspaces, `file:` deps replaced with `^1.0.0` for publish
5. **Match existing style** — minimal diffs, no over-engineering, reuse `core`, `repo-parser`, `vector-engine`, `git-integration`

---

## Current baseline (do not break)

| Package | Role |
|---------|------|
| `@contexthub/mcp-server` | MCP tools, stdio transport |
| `@contexthub/core` | Encrypted storage, `SecurityManager`, sessions |
| `@contexthub/cli` | Bin `contexthub`, setup/start/stop, agent integrations |
| `@contexthub/repo-parser` | Sandboxed code analysis |
| `@contexthub/vector-engine` | Embeddings + semantic search |
| `@contexthub/git-integration` | Git summary / recent changes |
| `@contexthub/skills` | 3 built-in skills only (no disk load) |

**Already shipped:**
- `ensure_session`, `record_turn`, `get_agent_policy`, enhanced `get_project_context`
- `setup` installs: `.cursor/rules`, `.cursor/mcp.json`, hooks, `AGENTS.md`/`CLAUDE.md` sections
- `resolveMcpServerEntry()` for npm-published MCP path
- Auto-redaction on `save_memory`

**Storage:** `.contexthub/` (gitignored) — `memories.json`, `sessions.json`, embeddings, `.keyfile`, `.auth-token`

---

## Strategic positioning vs Graphify

| Graphify | ContextHub (build this) |
|----------|-------------------------|
| Corpus → massive knowledge graph | Agent + repo → **encrypted memories** + **lite code graph** |
| Meetings, browser, PDF empire | **Code + docs in repo + agent turns** only (Phase 3 PDF = optional plugin) |
| Python CLI | TypeScript MCP + `contexthub` CLI |
| `graphify watch` | `contexthub watch` (incremental index) |
| Path/trace queries | `contexthub_query` unified tool + MCP |

---

# PHASE 1 — Core parity (implement completely)

## 1.1 `contexthub watch` (CLI + optional daemon)

**Command:** `contexthub watch [path]` (default `.`)

**Behavior:**
- Debounced file watcher (default 3s, configurable `--debounce`)
- Respect existing repo-parser limits: max files, size, no symlinks, sensitive file exclusion
- On change batch:
  - Re-parse affected files only
  - Patch local **code graph** snapshot (see 1.2)
  - Incrementally update vector embeddings for changed symbols/chunks
  - Write atomic: `.contexthub/graph/code-graph.json`, `.contexthub/graph/index-meta.json`
- Console output: files changed, nodes/edges patched, duration (no internal paths in errors)
- SIGINT clean shutdown

**Flags:** `--debounce <ms>`, `--no-embeddings`, `--quiet`

**Security:** validate all paths within repo root; cap files per watch cycle

---

## 1.2 Code knowledge graph v1 (`@contexthub/knowledge-graph` or extend `repo-parser`)

**New package recommended:** `packages/knowledge-graph` (depends: `shared-types`, `repo-parser`, `core`)

**Graph model (JSON on disk, encrypted optional via core wrapper):**

```typescript
interface CodeGraph {
  version: string;
  updatedAt: number;
  nodes: Array<{ id: string; kind: 'file' | 'symbol'; path: string; name?: string; lang?: string }>;
  edges: Array<{ from: string; to: string; kind: 'imports' | 'calls' | 'contains' }>;
}
```

**Capabilities:**
- Build full graph: `buildCodeGraph(repoPath)`
- Incremental patch: `patchCodeGraph(changedPaths: string[])`
- Query helpers:
  - `getRelatedSymbols(fileOrSymbol, limit)`
  - `getBlastRadius(fileOrSymbol)` — transitive importers/dependents
  - `tracePath(fromId, toId, maxHops)` — BFS with hop limit

**MCP tools (all safeHandler + validated):**
- `get_code_graph_stats`
- `get_related_symbols` — params: `path`, `symbol?`, `limit`
- `get_blast_radius` — params: `path`, `symbol?`, `depth?`
- `trace_code_path` — params: `from`, `to`, `maxHops?`
- Upgrade `update_knowledge_graph` to call real implementation

---

## 1.3 Memory ↔ code linking

**Extend memory schema** (`shared-types`):

```typescript
interface MemoryEntry {
  // existing fields...
  relatedPaths?: string[];   // max 20, repo-relative, validated
  relatedSymbols?: string[]; // max 20, sanitized
  commitHash?: string;       // optional, 7-40 chars
  branch?: string;
}
```

**Update:** `save_memory`, `record_turn` to accept optional linking fields; validate via `SecurityManager.validatePath` for each path

**MCP tool:** `search_memory_by_code` — params: `path`, `symbol?` — returns memories referencing that code

---

## 1.4 Unified query — `contexthub_query`

**CLI:** `contexthub query "<natural language>" [--limit 10]`

**MCP tool:** `contexthub_query` — params: `query`, `limit?`

**Pipeline (merge results, dedupe, rank):**
1. `semantic_search` (vector-engine)
2. `search_memory` (keyword)
3. Code graph traversal if query mentions file/symbol patterns
4. `get_recent_changes` if query implies timeline/history
5. Return structured response:

```typescript
{
  answerSummary: string;       // agent-composable text, not LLM-generated unless optional flag
  memories: MemoryEntry[];
  codeHits: { path, symbol?, reason }[];
  gitHits?: CommitSummary[];
  trace?: { hops: { type, id, label }[] };
}
```

Keep `answerSummary` as deterministic stitching initially (no external LLM call required)

---

## 1.5 Official agent skill pack

**Directory:** `packages/skills/contexthub-skill/` or repo root `skill/contexthub/`

**Skill commands (mirror Graphify UX):**
- `setup` — run equivalent of `contexthub setup`
- `query <text>` — maps to `contexthub_query`
- `remember <text>` — `save_memory` with type manual
- `why <topic>` — `contexthub_query` biased to decision/architecture memories
- `watch` — start watch mode instructions

**Integrate with `setup`:**
- Copy skill into `.claude/skills/contexthub/` or document path for Claude Code
- Cursor: rule already exists; add skill markdown reference
- Generate single source from `packages/cli/src/agent-integrations/policy.ts`

**Publish:** include skill files in `@contexthub/cli` npm `files` or separate `@contexthub/skill` package

---

## 1.6 Polyglot depth (repo-parser)

**Priority languages:** TypeScript/JavaScript, Python, Go, Rust, Java

**Per language extract:**
- Files, modules, top-level symbols (functions, classes)
- Import/export edges
- Simple call edges where AST permits (best-effort)

**Tests:** fixture repos per language under `packages/repo-parser/fixtures/`

---

# PHASE 2 — Recall & UX

## 2.1 Docs ingest (in-repo only)

**Scope:** `**/*.md`, `docs/**`, `README*`, ADR folders — NOT arbitrary PDFs in v1

**Package:** extend `repo-parser` or `packages/docs-ingest`

- Chunk markdown (max chunk size 8KB)
- Embed via `vector-engine`
- Graph nodes: `doc` kind linked to `file` nodes

**MCP tools:** `ingest_docs`, `search_docs` (semantic)

**Watch integration:** markdown changes trigger doc re-ingest

---

## 2.2 Git ↔ memory auto-link

On `record_turn` / `save_memory`:
- Best-effort: `git rev-parse HEAD`, branch name (if git repo)
- Store in memory metadata (no shell beyond `simple-git` already used)

**MCP tool:** `get_memories_for_commit` — param: `hash`

---

## 2.3 Session lifecycle improvements

- On `end_session`: auto-write `summary` memory (deterministic: count types, list relatedPaths)
- Duplicate detection: hash last N memories; skip if `record_turn` content >90% similar (simple Jaccard on words)
- `get_project_context` includes last summary + graph stats

---

## 2.4 Local dashboard (`apps/web`)

**Minimal Next.js or static Vite app:**
- List memories (decrypted in browser locally — fetch via local API or read-only CLI server)
- Search box → calls `contexthub query`
- Simple code graph visualization (vis.js or d3, read `code-graph.json` export)
- Security panel: encryption on/off, memory count, last redaction count (no secret content)

**CLI:** `contexthub dashboard` — starts localhost server, opens browser

**Security:** bind `127.0.0.1` only; optional auth token; sanitize all API errors

---

## 2.5 Graph HTML export

**CLI:** `contexthub export-graph [--output graph.html]`

Static HTML like Graphify marketing describes — nodes/edges from code graph, no external CDN if possible (inline JS)

---

# PHASE 3 — Scale & optional

## 3.1 Optional PDF plugin (`@contexthub/plugin-pdf`)

- Separate package, optional dependency
- Sandboxed: max pages, max size, no OCR cloud
- Not enabled by default

## 3.2 More languages

Expand repo-parser to 15+ languages incrementally

## 3.3 Team / encrypted sync (design only unless specified)

- E2E encrypted sync protocol doc in `docs/sync-design.md`
- Do not implement cloud without explicit spec

## 3.4 Performance caps (all phases)

| Limit | Value |
|-------|-------|
| Memory entries / repo | 10,000 |
| Graph nodes | 500,000 (configurable) |
| Watch files / cycle | 100 |
| Query result limit | 100 |

---

# MCP tool registry (final target)

| Tool | Phase |
|------|-------|
| `get_project_context` | exists — enhance |
| `get_agent_policy` | exists |
| `ensure_session` | exists |
| `record_turn` | exists — extend linking |
| `save_memory` / `search_memory` / `semantic_search` | exists |
| `save_session` / `end_session` | exists |
| `contexthub_query` | 1.4 |
| `get_code_graph_stats` | 1.2 |
| `get_related_symbols` | 1.2 |
| `get_blast_radius` | 1.2 |
| `trace_code_path` | 1.2 |
| `search_memory_by_code` | 1.3 |
| `ingest_docs` / `search_docs` | 2.1 |
| `get_memories_for_commit` | 2.2 |
| Existing repo/git/skills tools | keep |

---

# CLI command registry (final target)

| Command | Phase |
|---------|-------|
| `setup`, `init`, `start`, `stop` | exists |
| `memory`, `timeline`, `search` | exists |
| `watch` | 1.1 |
| `query` | 1.4 |
| `export-graph` | 2.5 |
| `dashboard` | 2.4 |
| `ingest-docs` | 2.1 |

---

# File / directory layout (target)

```
.contexthub/                    # gitignored
  memories.json                 # encrypted
  sessions.json
  graph/
    code-graph.json
    index-meta.json
  embeddings/
  active-session.json
  .keyfile
  .auth-token

.cursor/                        # committed after setup (no secrets)
  rules/contexthub-auto-memory.mdc
  mcp.json
  hooks/contexthub-record-turn.mjs
  hooks.json

packages/
  knowledge-graph/              # NEW phase 1.2
  docs-ingest/                  # NEW phase 2.1 (optional)
```

---

# Testing requirements

1. **Security tests** — extend existing 24 tests for new tools (traversal, redaction, limits)
2. **Unit tests** — graph patch, blast radius, query merge logic
3. **Integration** — temp repo: setup → watch → change file → query finds context
4. **npm publish smoke** — `npm pack` on cli includes templates, dist hooks

---

# Documentation updates (each phase)

- `README.md` — features + commands
- `quick-guide.md` — watch, query
- `docs/index.html` — new sections
- `AGENT_SETUP.md` — new tools
- `packages/cli/README.md` — npm usage

---

# Implementation order (strict)

```
1. packages/knowledge-graph + MCP tools (1.2)
2. Memory linking types + save/record_turn (1.3)
3. contexthub watch (1.1) using incremental patch
4. contexthub_query CLI + MCP (1.4)
5. Skill pack + setup integration (1.5)
6. Repo-parser language depth (1.6)
7. Phase 2 items in order 2.1 → 2.5
8. Phase 3 only if Phase 1–2 complete
```

After each step: `npm run build` must pass.

---

# Acceptance criteria (definition of done)

- [ ] `npx @contexthub/cli setup` in empty repo creates `.contexthub/`, MCP config, rules, hooks
- [ ] Cursor/Claude agent calling `ensure_session` + `record_turn` persists encrypted memories
- [ ] `contexthub watch .` patches graph under 2s for single-file TS change (typical laptop)
- [ ] `contexthub query "why JWT"` returns memories + code/git hits with trace array
- [ ] `get_blast_radius` on exported symbol returns >0 dependents in test fixture
- [ ] No secrets in logs; `.keyfile` never in API responses
- [ ] `npm run publish:packages` order documented and working
- [ ] All new MCP tools use `safeHandler`

---

# Agent execution instructions

When implementing this prompt:

1. Read `CLAUDE.md`, `SECURITY.md`, and existing package source before coding
2. Implement **one phase step at a time**; commit logical units
3. Do not add cloud services, browser history, or meeting ingest
4. Prefer extending existing packages over new abstractions
5. Every new user input path goes through `SecurityManager`
6. Update this checklist in PR description as items complete

---

*ContextHub — Secure MCP memory for agents. Build the graph for code, not for your entire life.*
