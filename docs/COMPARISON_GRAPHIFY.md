# ContextHub vs. Graphify: Architectural Comparison

A deep-dive architectural comparison between ContextHub and standard graph indexing tools like Graphify.

## Feature Matrix

| Feature | ContextHub | Graphify |
|---|---|---|
| **Graph Construction** | Multi-root monorepo workspace indexing with cross-package resolution | Simple single-directory mapping |
| **Secure Memory** | AES-256-GCM encrypted local auto-memories with key management | None (requires external vector database/plaintext logging) |
| **RRF Hybrid Query** | Blended keyword, semantic vector, and git pseudo-hits ranking | Naive graph traversal only |
| **Git Integration** | Automatic commit hash, branch tracking, and git-history hits | None |
| **Offline Privacy** | 100% airgapped (zero API keys, deterministic local embeddings) | Cloud-dependent or API key required |
| **Incremental Updates** | debounced file watch batches with delta patching (<50ms) | Requires full graph rebuild on change |

## Core Architectural Differences

### 1. Hybrid Search (RRF Pipeline)
While Graphify relies solely on traversing standard imports, ContextHub uses **Reciprocal Rank Fusion (RRF)** to merge results from:
1. **Semantic Search** (Local Bigram / Xenova)
2. **Lexical Search** (TF-IDF keyword matching)
3. **Graph-derived Connections** (Transitive God-nodes & Communities)
4. **Git-history Context** (Recent change frequency and authorship metrics)

This unified pipeline ensures high-fidelity context selection in under 10ms.

### 2. Multi-root Monorepo Support
Graphify breaks down on complex workspaces. ContextHub natively parses `contexthub.config.js` to map independent package boundaries (e.g. `pkg:core`, `pkg:cli`) using prefixing, resolving dependency imports across packages beautifully.
