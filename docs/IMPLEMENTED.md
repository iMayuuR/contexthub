# ContextHub — Implemented Features

> **Purpose:** Everything **already built** in this repo.  
> **Remaining work:** [`IMPLEMENTATION_PROMPT.md`](./IMPLEMENTATION_PROMPT.md)
>
> **Author:** Mayur Dattatray Patil · **License:** MIT · **Last updated:** 2026-05-19

---

## Table of contents

1. [Product summary](#1-product-summary)
2. [Packages](#2-packages)
3. [Security & storage](#3-security--storage)
4. [MCP tools](#4-mcp-tools)
5. [CLI commands](#5-cli-commands)
6. [Agent auto-memory](#6-agent-auto-memory)
7. [Code graph & reports](#7-code-graph--reports)
8. [Repo parser & tests](#8-repo-parser--tests)
9. [Docs ingest & PDF](#9-docs-ingest--pdf)
10. [Query & embeddings](#10-query--embeddings)
11. [Git integration](#11-git-integration)
12. [Dashboard & web UI](#12-dashboard--web-ui)
13. [Skills](#13-skills)
14. [CI, publish, limits](#14-ci-publish-limits)
15. [Documentation](#15-documentation)
16. [Runtime layout](#16-runtime-layout)

---

## 1. Product summary

| Aspect | Detail |
|--------|--------|
| **Product** | Local-first **MCP server** (`@contexthub/mcp-server`), stdio |
| **CLI** | `@contexthub/cli` — setup, watch, query, dashboard, report, etc. |
| **Positioning** | Encrypted agent memory + lite code graph for coding agents |

---

## 2. Packages

| Package | Role |
|---------|------|
| `@contexthub/shared-types` | Types, `CodeGraph`, `MemoryEntry` |
| `@contexthub/core` | Core, storage, security, `query-pipeline`, **`limits.ts`** |
| `@contexthub/knowledge-graph` | `CodeGraphManager`, **`report.ts`**, god-nodes, communities |
| `@contexthub/docs-ingest` | Markdown chunk + embed |
| `@contexthub/plugin-pdf` | PDF parse (gated by `CONTEXTHUB_ENABLE_PDF=1`) |
| `@contexthub/repo-parser` | 6-language regex parsers + **fixtures/tests** |
| `@contexthub/vector-engine` | Offline hash embeddings + similarity |
| `@contexthub/git-integration` | `simple-git` wrappers |
| `@contexthub/skills` | `architect`, `debug`, `review` (allowlist) |
| `@contexthub/mcp-server` | All MCP tools + **`context-bundle.ts`** (not yet registered as tools) |
| `@contexthub/cli` | Operator commands |

**Apps:** `apps/web` — Next.js UI with `contexthub-client.ts` (dashboard API consumer).

---

## 3. Security & storage

| Feature | Location |
|---------|----------|
| AES-256-GCM at rest | `MemoryStorage`, graph files |
| Atomic writes + mutex | `memory-storage.ts` |
| `validatePath`, `sanitizeInput`, `validateLimit`, etc. | `security.ts` |
| **`validateRelatedPaths` / `validateRelatedSymbols` / `validateCommitHash`** | `security.ts` |
| Redaction on save | `isSensitive` / `redactSensitive` |
| MCP `safeHandler` | All registered tools |
| Auth token | `.contexthub/.auth-token` |
| Duplicate detection (Jaccard > 0.9) | `memory-storage.ts` |
| Central caps | `packages/core/src/limits.ts` |

### Memory linking (complete)

`MemoryEntry` fields persisted on save:

- `relatedPaths` (max 20, `validatePath` each)
- `relatedSymbols` (max 20, sanitized)
- `commitHash` / `branch` (validated; auto-filled from git when omitted)

Wired in: `memory-storage.ts`, `save_memory`, **`record_turn`** MCP params.

---

## 4. MCP tools

Registered in `packages/mcp-server/src/index.ts`:

### Session & memory

`get_agent_policy` · `ensure_session` · `record_turn` · `save_session` · `end_session` · `get_project_context` · `save_memory` · `search_memory` · `semantic_search` · `search_memory_by_code` · `contexthub_query`

### Code graph

**Advanced Utilities**: `get_related_symbols`, `get_blast_radius`, `trace_code_path`, `search_memory_by_code`, `get_god_nodes`, `get_graph_communities`, `explain_symbol`.

**Session Delta Analysis (R-20)**: `what_changed_since_session` and `diff_code_graph` automatically track code graph snapshots and surface the exact code graph delta (nodes/edges added/removed), new memories, and new Git commits since an agent session began.

**Memory Compaction & Decay (R-21)**: Built-in memory compaction (`contexthub compact`) automatically groups and merges adjacent `prompt` and `response` memories into high-density `summary` nodes (preserving `pinned` memories). Provides automated database decay (`archiveOldMemories(maxAgeDays)`) that offloads stale session state into local secure archives (`.contexthub/archive/`).

### Graph intelligence

`get_god_nodes` · `get_graph_communities`

### Repo & git

`summarize_repo` · `get_architecture_summary` · `get_related_files` · `get_recent_changes` · `get_git_summary` · `get_memories_for_commit`

### Docs & PDF

`ingest_docs` · `search_docs` · `ingest_pdf` (only if `CONTEXTHUB_ENABLE_PDF=1`)

### Skills

`list_skills` · `load_skill` · `run_skill_command` — allowlist: `architect`, `debug`, `review`

### Context Bundle

`get_context_bundle` · `explain_symbol`

### MCP Resources & Prompts (R-22)

Exposes read-only environment representations and pre-configured prompt scripts:
- **Resources**:
  - `contexthub://policy`: Reads the system agent memory policy and returns it as `text/markdown`.
  - `contexthub://graph-stats`: Queries the code graph manager and outputs statistics in JSON.
  - `contexthub://report`: Reads the repository `GRAPH_REPORT.md` (or outputs generation help) as `text/markdown`.
- **Prompts**:
  - `summarize-session`: Guides the agent to produce a structured summary of their progress. Accepts optional `sessionId`.
  - `onboard-repo`: Provides a detailed explanation of the project context, framework, communities, and key files so a new agent can start immediately.
  - `pre-commit-review`: Provides a checklist prompt template for the LLM to perform pre-commit checks on local staging changes.

### Implemented in code but **not** registered as MCP tools yet

| Function | File | Remaining |
|----------|------|-----------|
| (None) | | |

---

## 5. CLI commands

| Command | Status |
|---------|--------|
| `init` · `setup` · `start` · `stop` | ✅ |
| `memory` · `timeline` · `search` | ✅ |
| `watch [path]` | ✅ (+ md re-ingest in batch) |
| `query <text>` | ✅ |
| `export-graph` | ✅ |
| `dashboard [--port]` | ✅ (uses `.auth-token`) |
| **`ingest-docs [patterns...]`** | ✅ |
| **`report`** | ✅ → `.contexthub/GRAPH_REPORT.md` |
| `doctor` · `status` · `benchmark` | ✅ |
| `export-memories` | ✅ portable, encrypted context bundle (`--out`, `--passphrase`) |

---

## 6. Agent auto-memory

**`contexthub setup`** installs:

| Artifact | Path |
|----------|------|
| Policy | `.contexthub/agent-policy.md` |
| Cursor rule | `.cursor/rules/contexthub-auto-memory.mdc` |
| MCP | `.cursor/mcp.json` |
| Hooks | `.cursor/hooks.json` + `contexthub-record-turn.mjs` |
| Agents | `AGENTS.md` · `CLAUDE.md` sections |
| **Skill** | `.claude/skills/contexthub/SKILL.md` via `installContexthubSkill()` |

**Session:** `packages/mcp-server/src/session-state.ts` · `end_session` writes summary memory.

---

## 7. Code graph & reports

**`CodeGraphManager`** (`packages/knowledge-graph`):

| Method | Purpose |
|--------|---------|
| `buildCodeGraph` / `patchCodeGraph` | Full / incremental |
| `getRelatedSymbols` / `getBlastRadius` / `tracePath` | Queries |
| **`getGodNodes(limit)`** | Hub scoring by degree |
| **`detectCommunities()`** | Connected components (file-level) |

**Reports:** `packages/knowledge-graph/src/report.ts` → `.contexthub/GRAPH_REPORT.md`  
Triggered by: `update_knowledge_graph`, **`contexthub report`**, watch (via graph update path in MCP).

---

## 8. Parsers (`repo-parser`)

**Tree-sitter WASM**: The parser uses `web-tree-sitter` and `@repomix/tree-sitter-wasms` to perform AST-based code traversal and symbol extraction for TypeScript, JavaScript, TSX, and Python. Falls back to Regex automatically if parsing fails.

**Regex Fallback**: Uses regex pattern matching to extract symbols, classes, and methods for Go, Rust, Java, Ruby, PHP, C#, Swift, Kotlin, Scala, and C/C++ (and TS/JS/Py if Tree-sitter fails).

**Capabilities**: Extracts classes, functions, variable declarations, methods, imports, and exports (including `__all__` in Python). Supports 15+ core languages natively.
**Security**: Excludes sensitive files (`.env`, `*.pem`, `id_rsa`, etc.), skips symbolic links natively, and skips files > 50MB. Includes a 5-second per-file timeout for Tree-sitter.

**Tests:**

| Package | Path |
|---------|------|
| core | `packages/core/src/__tests__/security.test.ts` |
| knowledge-graph | `packages/knowledge-graph/src/__tests__/graph.test.ts` |
| repo-parser | `packages/repo-parser/src/__tests__/parse.test.ts` |
| integration | `tests/integration/smoke.sh` |

**CI:** `.github/workflows/ci.yml` — Node 18/20/22, build, tests, smoke.

---

## 9. Docs ingest & PDF

| Feature | Detail |
|---------|--------|
| `DocsIngester` | Glob md, 8KB chunks, vector + graph nodes |
| MCP | `ingest_docs`, `search_docs` |
| Watch | Re-ingest `.md` in watch batches |
| **`@contexthub/plugin-pdf`** | `PdfParser`, max 50 pages / 20MB |
| MCP `ingest_pdf` | Env `CONTEXTHUB_ENABLE_PDF=1` only |

---

## 10. Query & embeddings

**`runUnifiedQuery`** (`query-pipeline.ts`): Uses Reciprocal Rank Fusion (RRF) to merge and rank results from semantic, keyword, graph-derived pseudo-hits, and git history pseudo-hits → `answerSummary`.

**Vector engine:** Supports 3 embedding modes (`local` with Bigram TF weighting, `off` for pure keyword fallback, and `transformers` for lazy-loaded `@xenova/transformers`). Deterministic hash-seeded embeddings (no API key) are the default.

---

## 11. Git integration

`getGitSummary` · `get_recent_changes` · `get_memories_for_commit` · auto `commitHash`/`branch` on `save_memory`.

---

## 12. Dashboard & web UI

**Dashboard** (`packages/cli/src/commands/dashboard.ts`):

- Bind `127.0.0.1`
- Auth: `.contexthub/.auth-token`
- Routes: `/`, `/api/health`, `/api/memories`, `/api/query`, `/api/graph`

**Web app** (`apps/web`):

- `src/lib/contexthub-client.ts`
- `.env.local.example` → `NEXT_PUBLIC_CONTEXTHUB_API`
- Pages: memories, search, timeline components

---

## 13. Skills

Built-in only: `architect`, `debug`, `review`. Source skill: `packages/skills/contexthub-skill/contexthub.md`.

---

## 14. CI, publish, limits

| Item | Detail |
|------|--------|
| `npm test` | Workspace tests via `--workspaces --if-present` |
| `publish-packages.js` | Order includes `knowledge-graph`, `docs-ingest`, `plugin-pdf` |
| **`limits.ts`** | Central caps (memory, query, watch batch, graph display, PDF, dashboard) |
| **`loadConfig`** | Dynamic config loader parsing `contexthub.config.js` via `createRequire` and validating limits |
| **Multi-root** | Monorepo configuration mapping multiple `roots` using prefixed node IDs (`pkg:core#src/index.ts`) |
| **`contexthub ci`** | Non-interactive CI command: runs setup checks, updates code graph, and prints `GRAPH_REPORT` to `$GITHUB_STEP_SUMMARY` |
| **GitHub Action** | Composite action at `.github/actions/contexthub/action.yml` for posting PR blast-radius comments using secure GH CLI |

---

## 15. Documentation

| File | Content |
|------|---------|
| `CLAUDE.md` · `SECURITY.md` · `AGENT_SETUP.md` · `quick-guide.md` · `README.md` | User + agent docs |
| **`docs/sync-design.md`** | Team sync design (v1 non-goals, E2E blobs) |
| **`docs/BENCHMARKS.md`** | Performance benchmark numbers (~3.3s graph build, <10ms searches) |
| **`docs/COMPARISON_GRAPHIFY.md`** | Architectural highlights comparison between ContextHub and naive Graphify |
| **`docs/AIRGAP.md`** | Security architecture for completely offline, airgapped deployments |
| **`examples/demo-repo/`** | Standard demonstration setup with TS, contexthub.config.js, and helper |
| `docs/index.html` | Marketing / MCP site |
| `docs/IMPLEMENTED.md` | This file |
| `docs/IMPLEMENTATION_PROMPT.md` | Remaining backlog only |

---

## 16. Runtime layout

```
.contexthub/
├── memories.json · sessions.json · project-metadata.json
├── active-session.json · .keyfile · .auth-token
├── GRAPH_REPORT.md
├── embeddings/index.json
└── graph/code-graph.json · index-meta.json
```

---

## Completion snapshot

| Area | ~Status |
|------|---------|
| Phase 1–2 (core product) | **~95%** |
| Phase 3 (PDF, sync design, limits) | **~70%** (15+ langs pending) |
| Phase 5 (Graphify-class polish) | **~35%** (god-nodes/report done; doctor, RRF, tree-sitter, etc. pending) |

---

*Next steps → [`IMPLEMENTATION_PROMPT.md`](./IMPLEMENTATION_PROMPT.md)*
