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

- **🧠 Persistent Memory** — Saves conversations, decisions, and learnings across sessions
- **🔍 Semantic Search** — Natural language queries across all your memories
- **📊 Code Intelligence** — Analyzes repo structure, dependencies, and architecture
- **🔌 MCP-Compatible** — Works with Claude Code, Cursor, and any MCP client
- **🔒 Encrypted Storage** — AES-256-GCM encryption at rest for all data
- **🛡️ Auto-Redaction** — API keys, tokens, and passwords are automatically detected and redacted
- **🌐 Local Dashboard** — View and explore memories visually
- **📚 Docs Ingest** — Ingest markdown docs for context
- **📈 Learns Over Time** — Improves relevance through usage patterns
- **🌐 Local-First** — All data stays on your machine, never leaves your repo

---

## Quick Start

### One-Command Installation

```bash
# Navigate to your project
cd your-project

# Initialize ContextHub (starts MCP server + encrypted storage)
npx @contexthub/cli setup

# Or for local development
git clone https://github.com/iMayuuR/contexthub.git
cd contexthub
npm install
npm run build
node packages/cli/dist/index.js setup
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
# List all memories
contexthub memory --list

# Add a memory manually
contexthub memory --add "Handle race condition in auth module"

# Search memories
contexthub memory --search "authentication bug"

# Filter by type
contexthub memory --list --type bugfix

# View session timeline
contexthub timeline --limit 20

# Semantic search (vector-enabled)
contexthub search --query "how to implement caching" --limit 5

# Start MCP server manually
contexthub start --port 3000

# Stop MCP server cleanly
contexthub stop

# Launch local dashboard
contexthub dashboard

# Ingest documentation
contexthub ingest-docs
```

---

## Architecture

```
contexthub/
├── packages/
│   ├── core/              # Memory storage, encryption & session management
│   │   ├── security.ts    # 🔒 SecurityManager (AES-256-GCM, validation)
│   │   └── memory-storage.ts # Encrypted JSON storage with atomic writes
│   ├── cli/               # Command-line interface
│   │   ├── setup.ts       # Secure initialization (no shell modification)
│   │   ├── start.ts       # Server with PID tracking
│   │   └── stop.ts        # Clean shutdown command
│   ├── mcp-server/        # MCP protocol server (hardened)
│   ├── vector-engine/     # Embeddings & semantic search
│   ├── repo-parser/       # Code structure analysis (sandboxed)
│   ├── git-integration/   # Git history & commit tracking
│   ├── context-injector/  # Smart context retrieval
│   ├── memory-engine/     # Advanced memory algorithms
│   ├── agent-connectors/  # AI agent adapters (sanitized)
│   ├── skills/            # Built-in skill modules (locked)
│   └── shared-types/      # TypeScript interfaces
├── SECURITY.md            # 🔒 Full security scan report
└── .contexthub/           # Per-repo encrypted storage
    ├── memories.json      # 🔐 Encrypted memory storage
    ├── sessions.json      # 🔐 Encrypted session history
    ├── project-metadata.json # 🔐 Encrypted metadata
    ├── .keyfile           # 🔑 Encryption key (mode 0600)
    ├── .auth-token        # 🔑 MCP auth token (mode 0600)
    ├── server.pid         # Process ID for server management
    └── embeddings/        # Vector embeddings
```

### How It Works

1. **Capture** — Interactions saved via MCP tools (no shell hooks)
2. **Sanitize** — All input validated, sensitive data auto-redacted
3. **Encrypt** — Data encrypted with AES-256-GCM before writing to disk
4. **Analyze** — RepoParser builds code structure understanding (sandboxed)
5. **Embed** — VectorEngine generates semantic embeddings
6. **Inject** — ContextInjector retrieves relevant context for AI queries

---

## MCP Tools Available

| Tool | Description |
|------|-------------|
| `get_project_context` | Project metadata + recent sessions |
| `search_memory` | Full-text search across memories |
| `semantic_search` | Vector similarity search |
| `save_session` | Create new agent session |
| `end_session` | End an active session |
| `save_memory` | Store memory entry (sanitized + encrypted) |
| `summarize_repo` | Generate repository summary |
| `get_architecture_summary` | Code structure analysis |
| `get_related_files` | Find connected code files |
| `get_recent_changes` | Git commit history |
| `get_git_summary` | Git repository status |
| `update_knowledge_graph` | Refresh code analysis + generate report |
| `get_god_nodes` | Find highest-connectivity files |
| `get_graph_communities` | Detect file-level connected components |
| `ingest_pdf` | Extract text from PDF documents |
| `list_skills` / `load_skill` | Skills system |
| `run_skill_command` | Execute built-in skill commands |

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

### Package Structure

| Package | Purpose |
|---------|---------|
| `@contexthub/core` | Core API — sessions, memories, encryption, SecurityManager |
| `@contexthub/vector-engine` | Embedding generation & similarity search |
| `@contexthub/repo-parser` | Code parsing & analysis (sandboxed) |
| `@contexthub/git-integration` | Git operations via simple-git |
| `@contexthub/mcp-server` | MCP protocol implementation (hardened) |
| `@contexthub/agent-connectors` | Claude Code, Cursor adapters (sanitized) |
| `@contexthub/skills` | Built-in skill modules (locked) |
| `@contexthub/shared-types` | TypeScript interfaces |

---

## Implementation roadmap

Implemented features: [`docs/IMPLEMENTED.md`](docs/IMPLEMENTED.md) · Remaining work (agents): [`docs/IMPLEMENTATION_PROMPT.md`](docs/IMPLEMENTATION_PROMPT.md)

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