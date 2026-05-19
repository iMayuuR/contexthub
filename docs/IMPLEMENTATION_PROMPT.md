# ContextHub — Final Pending Work (one shot)

> **Agents: complete EVERY item in [§1](#1-pending-checklist) in a single session/PR.**  
> Do not re-implement features listed in [`IMPLEMENTED.md`](./IMPLEMENTED.md).
>
> **Read first:** `CLAUDE.md`, `SECURITY.md`, `AGENT_SETUP.md`  
> **Author:** Mayur Dattatray Patil · **Repo:** https://github.com/iMayuuR/contexthub

---

## 1. Pending checklist

| # | Task | Done when |
|---|------|-----------|
| P1 | **`watch` respects `contexthub.config.js` `roots`** — use `loadConfig(repoPath).roots` in `packages/cli/src/commands/watch.ts` (graph build already multi-root via `knowledge-graph`; watch must match) | Changing `roots` in config changes which dirs `watch` observes |
| P2 | **God-node fixture test** — add `packages/knowledge-graph/fixtures/hub-graph.json` (synthetic ~10k nodes or generator in test) + assert `getGodNodes(10)` returns ≥3 hubs | Test passes in `npm test --workspace=packages/knowledge-graph` |
| P3 | **`get_context_bundle` latency test** — integration or unit test: `buildContextBundle` on `examples/demo-repo` completes in **< 500ms** (generous CI timeout OK; fail if > 1s locally) | Test in core or mcp-server `__tests__` |
| P4 | **`contexthub doctor` smoke test** — in `packages/cli/src/__tests__/doctor.test.ts` or extend `tests/integration/smoke.sh`: after `setup` in temp dir, `doctor` exits 0 | CI green |
| P5 | **RRF vs naive merge test** — in `packages/core/src/__tests__/query-pipeline.test.ts`: fixture where keyword-only misses but semantic+graph finds target; assert RRF ranks target higher than naive merge | Test passes |
| P6 | **Local embeddings smoke** — in `packages/vector-engine` or core test: `mode: 'local'`, no API key, `searchSimilarText` returns expected top hit on 5–10 seeded memories | Test passes |
| P7 | **Doc sync** — update `IMPLEMENTED.md` completion table; remove any stale “not done” notes; ensure `README.md` links `IMPLEMENTED.md` + this file | Docs accurate |
| P8 | **Delete this file’s checklist rows** — when P1–P7 pass, replace `IMPLEMENTATION_PROMPT.md` body with a short “All roadmap items complete” note (keep link to `IMPLEMENTED.md`) | File reflects zero pending |

---

## 2. One-shot agent kickoff (copy-paste)

```text
You are finishing ContextHub. Read docs/IMPLEMENTED.md — do NOT rebuild listed features.

Open docs/IMPLEMENTATION_PROMPT.md §1 and complete P1 through P7 in ONE PR.

Rules:
- Follow SECURITY.md (safeHandler, validatePath, no secrets in logs).
- npm run build && npm test must pass.
- Add only tests + watch multi-root fix + doc updates.
- When done: update IMPLEMENTED.md, then apply P8 (shrink IMPLEMENTATION_PROMPT.md to “complete”).

Do not ask for confirmation between P1–P7. Execute all.
```

---

## 3. Implementation hints (minimal)

### P1 — Watch multi-root

```typescript
import { loadConfig } from '@contexthub/core';

const config = loadConfig(currentDir);
const roots = config.roots ?? ['.'];
// chokidar: watch each resolved root under repoPath, or single watcher with multiple globs
// Reuse ContexthubIgnore per changed file (already in watch.ts)
```

### P2 — Hub graph fixture

- Option A: committed JSON ~10k nodes (may be large — prefer generator in test).
- Option B: test builds chain: `file:0` → `file:1` → … with 3 hub nodes with fan-in 50+.

### P3 — Bundle latency

```typescript
const t0 = Date.now();
await buildContextBundle({ query: 'helper', repoPath: demoRepo }, ctx, vector, graph, git);
assert.ok(Date.now() - t0 < 500); // or 1000 for CI
```

### P4 — Doctor

```bash
tmpdir=$(mktemp -d); cd $tmpdir && git init
npx contexthub setup   # or node path to cli
npx contexthub doctor
# expect exit 0
```

### P5 — RRF test

Seed memories: one with unique token `xyzzy_arch_decision`. Query `xyzzy architecture`. Naive keyword-only may miss; semantic/graph should hit. Compare `runUnifiedQuery` vs a stub that only uses keyword branch.

### P6 — Embeddings

```typescript
const ve = new VectorEngine(repoPath, 'local');
// embed 3 memories with distinct content, search should rank best match first
```

---

## 4. Security (still apply)

- Tests use temp dirs; never commit `.contexthub/.keyfile` or `.auth-token`
- Doctor test must not print token contents
- Fixture paths repo-relative only

---

*After P8: roadmap complete — maintain features in `IMPLEMENTED.md` only.*
