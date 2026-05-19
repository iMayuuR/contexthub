# ContextHub — Implemented Features

> **Everything built in this repo.** Pending polish/tests only → [`IMPLEMENTATION_PROMPT.md`](./IMPLEMENTATION_PROMPT.md)  
> **Author:** Mayur Dattatray Patil · **License:** MIT · **Last updated:** 2026-05-19 (synced with `master` @ `150cdd1+)

---

## 1. Product

| Aspect | Detail |
|--------|--------|
| **Product** | Local-first **MCP server** (`@contexthub/mcp-server`), stdio |
| **CLI** | `@contexthub/cli` — operator / launcher |
| **Tagline** | Secure MCP memory for agents — code graph, not life corpus |

---

## 2. Packages

| Package | Role |
|---------|------|
| `shared-types` | Types, `CodeGraph`, `MemoryEntry` |
| `core` | Storage, security, **RRF query**, **config**, **contexthub-ignore**, limits |
| `knowledge-graph` | Graph build/patch, god-nodes, communities, **GRAPH_REPORT** |
| `docs-ingest` | Markdown chunk + embed |
| `plugin-pdf` | PDF parse (`CONTEXTHUB_ENABLE_PDF=1`) |
| `repo-parser` | **Tree-sitter** (TS/JS/TSX/Py) + regex **15+ languages** |
| `vector-engine` | `local` (bigram TF), `off`, optional `transformers` |
| `git-integration` | `simple-git` |
| `skills` | `architect`, `debug`, `review` (allowlist) |
| `mcp-server` | All MCP tools, resources, prompts, context bundle |
| `cli` | All commands below |

**Apps:** `apps/web` — Next.js + `contexthub-client.ts` (dashboard API).

---

## 3. Security & storage

- AES-256-GCM, atomic writes, mutex, plaintext→encrypted migration  
- `validatePath`, redaction, `isSensitiveFile`, symlink skip  
- `.auth-token` MCP auth · `safeHandler` on all tools  
- Memory linking: `relatedPaths`, `relatedSymbols`, `commitHash`, `branch` on save / `record_turn`  
- Duplicate detection (Jaccard), `compactMemories`, `archiveOldMemories`  
- Caps: `packages/core/src/limits.ts`

---

## 4. MCP tools (registered)

**Session & memory:** `get_agent_policy`, `ensure_session`, `record_turn`, `save_session`, `end_session`, `get_project_context`, `save_memory`, `search_memory`, `semantic_search`, `search_memory_by_code`, `contexthub_query`

**Graph:** `get_code_graph_stats`, `get_related_symbols`, `get_blast_radius`, `trace_code_path`, `update_knowledge_graph`, `get_god_nodes`, `get_graph_communities`, `diff_code_graph`, `what_changed_since_session`

**Context:** `get_context_bundle`, `explain_symbol`

**Repo & git:** `summarize_repo`, `get_architecture_summary`, `get_related_files`, `get_recent_changes`, `get_git_summary`, `get_memories_for_commit`

**Docs:** `ingest_docs`, `search_docs`, `ingest_pdf` (env flag)

**Skills:** `list_skills`, `load_skill`, `run_skill_command`

**Resources:** `contexthub://policy`, `contexthub://graph-stats`, `contexthub://report`  
**Prompts:** `summarize-session`, `onboard-repo`, `pre-commit-review`

---

## 5. CLI commands

| Command | Purpose |
|---------|---------|
| `init` · `setup` · `start` · `stop` | Lifecycle + agent files + skill install |
| `memory` · `timeline` · `search` | Memory ops |
| `watch [path]` | Incremental graph + embeddings + md ingest |
| `query` · `context` | Unified / bundle query |
| `export-graph` · `dashboard` · `report` | Viz, UI, GRAPH_REPORT |
| `ingest-docs` | Markdown ingest |
| `doctor` · `status` · `benchmark` | Ops / health / perf |
| `compact [--archiveAge N]` | Merge pairs + optional archive |
| `export-memories` | Encrypted portable bundle |
| `ci` | Non-interactive CI mode |
| `blast-radius` | CLI blast radius helper |

---

## 6. Agent auto-memory

`setup` installs: `.contexthub/agent-policy.md`, Cursor rule + MCP + hooks, `AGENTS.md` / `CLAUDE.md`, `.claude/skills/contexthub/SKILL.md`.

Protocol: `ensure_session` → `get_project_context` → work → `record_turn` → `end_session`.

---

## 7. Code graph & query

- **Multi-root:** `contexthub.config.js` → `loadConfig().roots`, prefixed node ids (`pkg:…#path`) in `knowledge-graph`  
- **RRF:** `runUnifiedQuery` merges semantic, keyword, graph, git lists  
- **Reports:** `.contexthub/GRAPH_REPORT.md` via report CLI / graph update  

---

## 8. Parsers

- **Tree-sitter WASM:** TS, JS, TSX, Python (5s timeout, regex fallback)  
- **Regex:** Go, Rust, Java, Ruby, PHP, C#, Swift, Kotlin, Scala, C/C++  
- Fixtures + tests per language family under `packages/repo-parser/fixtures/`

---

## 9. CI & publish

- `.github/workflows/ci.yml` — Node 18/20/22, build, tests, `tests/integration/smoke.sh`  
- `.github/actions/contexthub/action.yml` — `contexthub ci` + PR blast-radius comment  
- `scripts/publish-packages.js` — full package order including kg, docs-ingest, plugin-pdf  

---

## 10. Documentation

| File | Purpose |
|------|---------|
| `docs/AIRGAP.md` | Offline / airgapped deployment |
| `docs/BENCHMARKS.md` | Perf numbers (~3.3s full graph, <10ms search) |
| `docs/COMPARISON_GRAPHIFY.md` | vs Graphify matrix |
| `docs/sync-design.md` | Future team sync (design only) |
| `examples/demo-repo/` | Demo TS project + sample config |
| `docs/index.html` | Marketing site |

---

## 11. Runtime layout

```
.contexthub/
├── memories.json · sessions.json · project-metadata.json
├── active-session.json · .keyfile · .auth-token
├── GRAPH_REPORT.md · embeddings/ · graph/
└── archive/          # after compact --archiveAge
```

---

## 12. Completion

| Area | Status |
|------|--------|
| Core product (MCP + CLI + graph + memory) | **Done** |
| Phase 3 (PDF, sync design, 15+ langs) | **Done** |
| Phase 5 (RRF, bundle, doctor, CI, docs) | **Done** |
| **Remaining** | Tests/polish only — see [`IMPLEMENTATION_PROMPT.md`](./IMPLEMENTATION_PROMPT.md) P1–P7 |

---

*Roadmap implementation complete; pending = verification + watch multi-root + doc hygiene.*
