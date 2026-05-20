# ContextHub MCP Skill Pack — Hardened Auto-Memory & Code Intelligence

This skill pack registers standard aliases and rules for coding agents to manage, query, and trace local-first project knowledge graph and memories.

## Agent Workflows

When working in this repository, always prefer using ContextHub unified tools to maintain secure, encrypted local memory. Do not ask for user permission before calling memory persistence tools (`record_turn`).

### 1. `setup` — Initial Session Configuration
Before starting any development cycle, start or verify the active session:
```bash
contexthub setup
# or call mcp tool: ensure_session(agent="cursor")
```

### 2. `query` — Search Memory & Knowledge Graph
Use the unified search when you need to answer questions about architecture, bugs, decisions, or git history:
```bash
contexthub query "recent changes in security manager"
# or call mcp tool: contexthub_query(query="recent changes in security manager")
```

### 3. `remember` — Save Architectural Decisions or Bugfixes
When a critical design decision is made, a bug is fixed, or a convention is defined, immediately record it:
```bash
contexthub memory --add "SecurityManager validates all path bounds using validatePath" --type architecture
# or call mcp tool: save_memory(content="...", type="architecture")
```

### 4. `why` — Code Graph Analysis & Dependency Tracing
To understand dependencies, relationships, or tracing path between two symbols:
* Check related symbols: `get_related_symbols(fileOrSymbol="SecurityManager")`
* Check blast radius of changes: `get_blast_radius(fileOrSymbol="SecurityManager")`
* Trace path from A to B: `trace_code_path(fromId="security.ts", toId="index.ts")`

### 5. `watch` — Real-time Incremental Watcher
To automatically update the knowledge graph on file modification:
```bash
contexthub watch
```

---

## Secure Auto-Memory Protocol
* **Strict Redaction**: Never write `.keyfile` or credentials into memory content.
* **Scope Restriction**: All paths are relative to the repository root.
* **Automatic record_turn**: Do not ask the user before calling `record_turn` at the end of a conversational turn.
