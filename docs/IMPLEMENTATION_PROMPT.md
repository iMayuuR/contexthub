# ContextHub — Remaining Work

> **Agents:** Implement **only** items in this file. Shipped features → [`IMPLEMENTED.md`](./IMPLEMENTED.md).
>
> **Before coding:** `CLAUDE.md`, `SECURITY.md`, `AGENT_SETUP.md`.
>
> **Author:** Mayur Dattatray Patil · **Repo:** https://github.com/iMayuuR/contexthub

---

## 1. Backlog

| ID | Task | Block |
*(No outstanding backlog items remaining)*

**Not in backlog (done):** memory linking, skill install, parser tests, CI, publish order, ingest-docs, dashboard auth, apps/web client, god-nodes, communities, GRAPH_REPORT, plugin-pdf, `sync-design.md`, `limits.ts`, `get_context_bundle` + `explain_symbol` MCP, `.contexthubignore` + `doctor` + `status` + `benchmark`, `RRF hybrid query`, `Embeddings upgrade`, `Tree-sitter WASM`, `Session graph delta`, `Memory decay + compact`, `MCP resources + prompts`, `Multi-root config`, `Config loader`, `CI Integration`, `PR blast-radius commenting`, `Demo repo & comparison docs`, `15+ repo-parser languages`, `export-memories CLI`.

---

## 2. Work order

*(All backlog tasks are successfully completed)*

One block per PR unless user batches.

---

## 3. Acceptance (pending)

| # | Criterion | Block |
|---|-----------|-------|
| 13 | `get_context_bundle` < 500ms small repo | R-15 |
| 14 | `contexthub doctor` passes on healthy setup | R-19 |
| 16 | `get_god_nodes` ≥3 hubs on 10k fixture | R-13 ✅ code exists — add fixture test in R-07 extension |
| 17 | Useful semantic search, zero API keys | R-17 |
| 18 | RRF beats naive merge on fixture | R-16 |

---

## 4. Agent rules

1. One `R-XX` at a time · `npm run build` must pass.
2. `safeHandler` + `SECURITY.md` on every new MCP tool.
3. Never commit `.contexthub/`, `.keyfile`, `.auth-token`.
4. Remove completed row from [§1](#1-backlog) and update [`IMPLEMENTED.md`](./IMPLEMENTED.md).

```text
Read IMPLEMENTED.md (do not redo listed items).
Execute R-15 only from IMPLEMENTATION_PROMPT.md §5.
npm run build && npm test
Update both docs when done.
```

---

## 5. Implementation prompts

### R-15 — Wire context bundle (partial code exists)

**Exists:** `packages/mcp-server/src/context-bundle.ts` — `buildContextBundle`, `explainSymbol`. Handlers `getContextBundleMcp` / `explainSymbolMcp` in `index.ts` but **not** `server.tool(...)`.

**Do:**

1. Register MCP tools:
```typescript
server.tool('get_context_bundle', {
  query: { type: 'string', optional: true },
  path: { type: 'string', optional: true },
  sessionId: { type: 'string', optional: true },
  limit: { type: 'number', optional: true },
}, safeHandler(async (args) => { /* require at least one of query|path|sessionId */ }));

server.tool('explain_symbol', {
  symbol: { type: 'string' },
  path: { type: 'string', optional: true },
}, safeHandler(explainSymbolMcp));
```

2. CLI `packages/cli/src/commands/context.ts` → print JSON from `buildContextBundle`.
3. Document in `AGENT_SETUP.md`.

**Done when:** Acceptance #13; Cursor MCP lists both tools.

---

### R-16 — RRF hybrid query

**File:** `packages/core/src/query-pipeline.ts`

```typescript
function rrfMerge<T extends { id: string }>(
  lists: Array<Array<T>>,
  k = 60
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, i) => {
      scores.set(item.id, (scores.get(item.id) || 0) + 1 / (k + i + 1));
    });
  }
  return scores;
}
```

Merge ranked lists: semantic, keyword, graph-derived pseudo-hits, git pseudo-hits. Cap 50 candidates → top `limit`.

**Done when:** Acceptance #18.

---

### R-17 — Local embeddings

**File:** `packages/vector-engine/src/index.ts`

| Mode | Behavior |
|------|----------|
| `local` | Hash + **bigram TF** weighting (default) |
| `off` | Keyword-only degradation |
| `transformers` | Optional lazy `@xenova/transformers` |

`setup` must not require API keys.

---

### R-18 — Tree-sitter

**TS/JS/Py** WASM in `repo-parser`; fallback regex. 5s timeout/file.

---

### R-19 — Operator UX

| Deliverable | Path |
|-------------|------|
| `.contexthubignore` parser | `packages/core/src/contexthub-ignore.ts` |
| Apply in | `watch`, `buildCodeGraph`, parser walk |
| `contexthub doctor` | `packages/cli/src/commands/doctor.ts` |
| `contexthub status` | `commands/status.ts` |
| `contexthub benchmark` | `commands/benchmark.ts` |

**doctor hard-fail:** `.contexthub` 0700, `.keyfile` 0600, memories decrypt, MCP resolves.

---

### R-20 — Session / graph delta

MCP: `what_changed_since_session({ sessionId })`, `diff_code_graph({ base?, head? })`.

Store optional graph snapshot id in session metadata on `ensure_session`.

---

### R-21 — Memory compact

`archiveOldMemories(maxAgeDays)` → `.contexthub/archive/`. CLI `contexthub compact` merges prompt+response → `summary` unless tag `pinned`.

---

### R-22 — MCP resources + prompts

**File:** `packages/mcp-server/src/resources.ts`

Resources: `contexthub://policy`, `contexthub://graph-stats`, `contexthub://report`.

Prompts: `summarize-session`, `onboard-repo`, `pre-commit-review`.

---

### R-23 — CI integration

`contexthub ci` — non-interactive: verify setup, `update_knowledge_graph`, optional `GRAPH_REPORT` to `$GITHUB_STEP_SUMMARY`.

`.github/actions/contexthub/action.yml` — PR blast-radius comment (max 20 files, no secrets).

---

### R-24 — Multi-root config

**Depends on R-26** — see below. Multiple `roots`, prefixed node ids (`pkg:core#file.ts`).

---

### R-25 — Demo & comparison docs

- `examples/demo-repo/`
- `docs/BENCHMARKS.md` (from `contexthub benchmark` output)
- `docs/COMPARISON_GRAPHIFY.md`
- `docs/AIRGAP.md`

---

### R-26 — Config loader (do before R-24)

**Create** `packages/core/src/config.ts`:

```typescript
export interface ContexthubConfig {
  roots?: string[];
  query?: { rrfK?: number };
  embeddings?: { mode?: 'local' | 'off' | 'transformers' };
  graph?: { maxNodes?: number; reportPath?: string };
  watch?: { debounceMs?: number; maxFilesPerBatch?: number };
  memory?: { maxAgeDays?: number };
}
export function loadConfig(repoPath: string): ContexthubConfig;
```

Load `contexthub.config.js` via `createRequire`; validate numbers with `validateLimit`.

---

### R-10 — 15+ languages

One PR per language: Ruby, Kotlin, Swift, PHP, C#, Scala, C/C++ — parser + fixture + test.

---

### R-27 — Export memories (optional)

`contexthub export-memories --out bundle.chub [--passphrase]` — scrypt + AES-256-GCM, no keyfile.

---

## 6. Security (new work)

- All new tools: `safeHandler`
- `contexthubignore` must not allow escaping repo root
- Doctor must not print `.auth-token` or `.keyfile` contents
- PR Action comments: paths only, no memory content

---

*MIT © Mayur Dattatray Patil*
