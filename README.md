# ContextHub

> **AI Memory Layer for Developers** — Persistent context, semantic search, and intelligent context injection for every AI agent in your repositories.

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-yellow.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node-18+-orange.svg" alt="Node">
  <img src="https://img.shields.io/badge/Security-Hardened-brightgreen.svg" alt="Security">
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-blueviolet.svg" alt="Encryption">
</p>

---

## What is ContextHub?

ContextHub is a **local-first, privacy-focused AI memory and context orchestration layer** that gives coding agents persistent memory across sessions. It understands your codebase, provides intelligent context injection to any AI agent, and keeps all your data **encrypted and private**.

### Key Features

- **⚡ Token & Cost Optimizer** — Saves **70%-90% context window** and API costs via smart session compression and dynamic RRF filtering
- **🧠 Persistent Memory** — Saves conversations, decisions, and learnings across sessions
- **🔍 Semantic Search** — Natural language queries across all your memories with offline-verified local bigram embeddings
- **📊 Code Intelligence** — Analyzes repo structure, dependencies, and transitive God-nodes
- **🔌 MCP-Compatible** — Works natively with Cursor, Claude Code, Windsurf, and any stdio MCP client
- **🔒 Encrypted Storage** — Bank-grade AES-256-GCM encryption at rest with per-repo unique salt
- **🛡️ Auto-Redaction** — API keys, tokens, private keys, and passwords detected and redacted before write
- **🌐 Local Dashboard** — Interactive web dashboard to visually explore memory timelines and codebase topology
- **🌿 Git Integration** — Automatically maps memories to branches, authors, commit hashes, and file diffs
- **📂 Multi-Root Support** — Standard multi-root workspace configs limit file indexing strictly to active folders
- **📚 Docs Ingest** — Ingest markdown directories and PDFs directly into semantic memory
- **🌐 Local-First** — Zero telemetry and zero external network calls. Your code and memories never leave your workstation

---

## Quick Start

### One-Command Installation

```bash
# Standard scope:
npx @contexthub/cli setup

# OR custom scope:
npx @imayuur/contexthub setup
```

That's it! ContextHub will:
1. Initialize encrypted storage in `.contexthub/`
2. Generate encryption key (`.contexthub/.keyfile`, mode `0600`)
3. Generate auth token (`.contexthub/.auth-token`)
4. Start the MCP server in background with PID tracking

### For AI Agents

Configure your AI agent to connect to ContextHub as an MCP server via stdio transport. The agent will automatically:
- Fetch relevant context before responding
- Save interactions as encrypted memories
- Query the knowledge graph and repo intelligence

---

## Usage Examples

### CLI Commands

```bash
# Memory operations
contexthub memory --list
contexthub memory --add "Handle race condition in auth module"
contexthub memory --search "authentication bug"
contexthub memory --list --type bugfix

# Session timeline
contexthub timeline --limit 20

# Semantic search (vector-enabled)
contexthub search --query "how to implement caching" --limit 5

# Unified RRF query (memory + graph + git)
contexthub query "auth race condition"

# Generate context bundle for agents
contexthub context --query "caching strategy"

# Watch for incremental graph updates
contexthub watch

# Launch interactive dashboard
contexthub dashboard

# Server lifecycle
contexthub start --port 3000
contexthub stop

# Ingest documentation
contexthub ingest-docs

# Health & performance
contexthub doctor
contexthub benchmark
```

---

## Dashboard (Interactive Web UI)

```bash
# Launch the local dashboard (localhost only)
contexthub dashboard

# Custom port
contexthub dashboard --port 4000
```

Opens at `http://127.0.0.1:3847`. Features:
- **Memory Feed** — browse all encrypted memories with tags and timestamps
- **Intelligent Query** — unified search across memories, graph, and git
- **Topology Graph** — interactive force-directed Vis.js graph of your codebase dependencies
- Click any node to inspect package workspace, dependency degree, and direct neighbors

> Dashboard binds to `127.0.0.1` only — never exposed to the network.

---

## Architecture

```
contexthub/
├── packages/              # 14 packages
│   ├── shared-types/      # TypeScript interfaces (Session, MemoryEntry, CodeGraph)
│   ├── core/              # Storage, security, RRF query, config, limits
│   ├── cli/               # 24 CLI commands (setup, dashboard, watch, query, etc.)
│   ├── mcp-server/        # MCP protocol server (35+ tools, hardened)
│   ├── knowledge-graph/   # Code graph: god-nodes, communities, snapshots, reports
│   ├── vector-engine/     # Embeddings: local bigram TF-IDF, optional transformers
│   ├── repo-parser/       # Tree-sitter (TS/JS/TSX/Py) + regex 15+ languages
│   ├── git-integration/   # Git history & commit tracking (simple-git)
│   ├── docs-ingest/       # Markdown chunk + embed into vector engine
│   ├── plugin-pdf/        # PDF parse (optional, env flag)
│   ├── context-injector/  # Smart context retrieval
│   ├── memory-engine/     # Compact, archive, deduplication algorithms
│   ├── agent-connectors/  # AI agent adapters (sanitized)
│   └── skills/            # Built-in skills only: architect, debug, review
├── scripts/               # publish-packages.js, rename-scope.js
├── docs/                  # IMPLEMENTED, BENCHMARKS, AIRGAP, COMPARISON
├── SECURITY.md            # 🔒 Full security scan report (26 findings, all fixed)
└── .contexthub/           # Per-repo encrypted storage (created at runtime)
    ├── memories.json      # 🔐 Encrypted memory storage
    ├── sessions.json      # 🔐 Encrypted session history
    ├── project-metadata.json # 🔐 Encrypted metadata
    ├── .keyfile           # 🔑 Encryption key (mode 0600)
    ├── .auth-token        # 🔑 MCP auth token (mode 0600)
    ├── server.pid         # Process ID for server management
    ├── graph/             # 🔐 Encrypted code knowledge graph
    ├── embeddings/        # Vector embeddings
    └── GRAPH_REPORT.md    # Auto-generated dependency report
```

### How It Works

1. **Capture** — Interactions saved via MCP tools (no shell hooks)
2. **Sanitize** — All input validated, sensitive data auto-redacted
3. **Encrypt** — Data encrypted with AES-256-GCM before writing to disk
4. **Analyze** — RepoParser builds code structure understanding (sandboxed)
5. **Embed** — VectorEngine generates semantic embeddings
6. **Inject** — ContextInjector retrieves relevant context for AI queries

---

## MCP Tools Available (35+)

**Session & Memory:** `ensure_session`, `record_turn`, `save_session`, `end_session`, `get_project_context`, `save_memory`, `search_memory`, `semantic_search`, `search_memory_by_code`, `contexthub_query`, `get_context_bundle`, `explain_symbol`

**Code Graph:** `get_code_graph_stats`, `get_related_symbols`, `get_blast_radius`, `trace_code_path`, `update_knowledge_graph`, `get_god_nodes`, `get_graph_communities`, `diff_code_graph`, `what_changed_since_session`

**Repo & Git:** `summarize_repo`, `get_architecture_summary`, `get_related_files`, `get_recent_changes`, `get_git_summary`, `get_memories_for_commit`

**Docs & Skills:** `ingest_docs`, `search_docs`, `ingest_pdf`, `list_skills`, `load_skill`, `run_skill_command`

**Resources:** `contexthub://policy`, `contexthub://graph-stats`, `contexthub://report`
**Prompts:** `summarize-session`, `onboard-repo`, `pre-commit-review`

> All tools are wrapped with `safeHandler()` — errors never expose internal paths or stack traces.

---

## Security & Privacy

ContextHub is **secure by design**. See [SECURITY.md](SECURITY.md) for the full audit report.

| Protection | Details |
|------------|---------|
| 🔐 **Encryption** | AES-256-GCM at rest for all data files |
| 🛡️ **Auto-Redaction** | API keys, tokens, passwords detected and redacted |
| 🚫 **No Shell Hooks** | No `.bashrc`/`.zshrc` modification, no command capture |
| 🔒 **Path Safety** | Directory traversal and symlink attacks prevented |
| ✅ **Input Validation** | All parameters validated and sanitized |
| 🔑 **Auth Support** | Optional HMAC token authentication for MCP |
| 📦 **Atomic Writes** | No data corruption on crash |
| 🧹 **Error Sanitization** | No internal paths or stack traces leaked |
| 🏠 **Local-First** | Zero telemetry, zero external calls |
| 🔗 **0 npm Vulnerabilities** | Clean dependency tree |

### Quick Security Setup

```bash
# Optional: Enable MCP authentication
export CONTEXTHUB_TOKEN=your-secret-token

# Optional: Provide your own encryption key
export CONTEXTHUB_KEY=your-strong-passphrase

# Optional: Enable the ingest_pdf tool (max 50 pages / 20MB per file)
export CONTEXTHUB_ENABLE_PDF=1

# Verify file permissions
ls -la .contexthub/
# Directory: drwx------ (700)
# Files:    -rw------- (600)
```

---

## Memory Types

| Type | Description |
|------|-------------|
| `prompt` | User prompt / query |
| `response` | AI response / solution |
| `summary` | Session summary |
| `decision` | Architectural decision |
| `architecture` | Design pattern / structure |
| `bugfix` | Bug description & fix |
| `manual` | User-added note |
| `commit` | Git commit record |

---

## Skills System

ContextHub includes **3 built-in skills** (no external skill loading for security):

| Skill | Commands | Triggers |
|-------|----------|----------|
| `architect` | `analyze` — Analyze codebase architecture | architecture, design, structure |
| `debug` | `find-similar` — Find similar past bugs | bug, error, fix, issue |
| `review` | `review-changes` — Review recent changes | review, pr, pull request |

---

## System Limits

ContextHub enforces strict performance caps centrally to ensure agents don't freeze your system or consume unbounded tokens:

- **Memory Context Size:** 50KB maximum per entry
- **Total Memories:** 10,000 max entries per repo
- **Graph Display Nodes:** 5,000 nodes rendered max
- **Search Query Result:** 100 max entries returned
- **Repo Parser Limits:** 1,000 files max, 1MB max file size
- **Memory Tags/Refs:** 20 tags, 20 linked paths, 20 linked symbols

---

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/iMayuuR/contexthub.git
cd contexthub

# Install dependencies
npm install

# Build all packages
npm run build

# Run CLI
node packages/cli/dist/index.js --help
```

### Package Structure (14 packages)

| Package | Purpose |
|---------|---------|
| `shared-types` | TypeScript interfaces (Session, MemoryEntry, CodeGraph) |
| `core` | Storage, security, RRF query, config, contexthub-ignore, limits |
| `cli` | 24 CLI commands (setup, dashboard, watch, query, etc.) |
| `mcp-server` | MCP protocol with 35+ tools, resources, prompts |
| `knowledge-graph` | Graph build/patch, god-nodes, communities, reports, snapshots |
| `vector-engine` | Local bigram TF-IDF embeddings, optional transformers |
| `repo-parser` | Tree-sitter WASM (TS/JS/TSX/Py) + regex 15+ languages |
| `git-integration` | Git operations via simple-git |
| `docs-ingest` | Markdown chunk + embed into vector engine |
| `plugin-pdf` | PDF text extraction (optional, env flag) |
| `memory-engine` | Compact, archive, deduplication algorithms |
| `context-injector` | Smart context retrieval and prompt enhancement |
| `agent-connectors` | AI agent adapters (sanitized with safeSaveMemory) |
| `skills` | Built-in only: architect, debug, review (allowlist) |

---

## Implementation Roadmap

All features, optimizations, and unit/integration tests are 100% complete. See the detailed roadmap report: [`docs/IMPLEMENTED.md`](docs/IMPLEMENTED.md).

## Roadmap

- [x] Web Dashboard for memory visualization
- [x] Comprehensive test suite
- [ ] Electron desktop app with system tray
- [ ] WebSocket transport for MCP
- [ ] Cloud sync with E2E encryption
- [ ] Team collaboration features

---

## Contributing

Contributions welcome! Please read our Contributing Guide and submit PRs.

## License

MIT © 2026 Mayur Dattatray Patil

---

<p align="center">
  <strong>Built for developers who want AI that actually understands their code — securely.</strong>
</p>