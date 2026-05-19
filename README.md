# ContextHub

> **AI Memory Layer for Developers** — Persistent context, semantic search, and intelligent context injection for every AI agent in your repositories.

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-yellow.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node-18+-orange.svg" alt="Node">
</p>

---

## What is ContextHub?

ContextHub is a **local-first, privacy-focused AI memory and context orchestration layer** that gives coding agents persistent memory across sessions. It automatically captures your work context, understands your codebase, and provides intelligent context injection to any AI agent.

### Key Features

- **🧠 Persistent Memory** — Automatically saves conversations, decisions, and learnings
- **🔍 Semantic Search** — Natural language queries across all your memories
- **📊 Code Intelligence** — Analyzes repo structure, dependencies, and architecture
- **🔌 MCP-Compatible** — Works with Claude Code, Cursor, and any MCP client
- **🔄 Automatic Context** — No user input needed; captures everything automatically
- **📈 Learns Over Time** — Improves relevance through usage patterns
- **🌐 Local-First** — All data stays in your repository by default
- **🚀 One-Command Setup** — `npx @contexthub/cli setup` and you're ready

---

## Quick Start

### One-Command Installation

```bash
# Navigate to your project
cd your-project

# Initialize ContextHub (auto-starts MCP server + memory saving)
npx @contexthub/cli setup

# Or for local development
git clone https://github.com/contexthub/contexthub.git
cd contexthub
npm install
npm run build
node packages/cli/dist/index.js setup
```

That's it! ContextHub will:
1. Initialize in `.contexthub/`
2. Start the MCP server in background (`localhost:3000`)
3. Enable automatic memory capture via shell hook

### For AI Agents

Configure your AI agent to connect to `http://localhost:3000` as an MCP server. The agent will automatically:
- Fetch relevant context before responding
- Save interactions as memories
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
```

---

## Architecture

```
contexthub/
├── packages/
│   ├── core/              # Memory storage & session management
│   ├── cli/               # Command-line interface
│   ├── mcp-server/        # MCP protocol server
│   ├── vector-engine/     # Embeddings & semantic search
│   ├── repo-parser/       # Code structure analysis
│   ├── git-integration/   # Git history & commit tracking
│   ├── context-injector/  # Smart context retrieval
│   ├── memory-engine/      # Advanced memory algorithms
│   ├── agent-connectors/  # AI agent adapters
│   ├── skills/            # Reusable skill modules
│   └── shared-types/      # TypeScript interfaces
├── apps/
│   ├── web/               # Dashboard (coming soon)
│   └── desktop/           # Electron app (coming soon)
└── .contexthub/           # Per-repo storage
    ├── memories.json      # Memory storage
    ├── sessions.json      # Session history
    ├── embeddings/        # Vector embeddings
    ├── graph/             # Knowledge graph
    └── skills/            # Custom skills
```

### How It Works

1. **Capture** — Every command, decision, and interaction is automatically saved
2. **Analyze** — RepoParser builds code structure understanding
3. **Embed** — VectorEngine generates semantic embeddings
4. **Store** — Memories persist in `.contexthub/memories.json`
5. **Inject** — ContextInjector retrieves relevant context for AI queries

---

## MCP Tools Available

| Tool | Description |
|------|-------------|
| `get_project_context` | Project metadata + recent sessions |
| `search_memory` | Full-text search across memories |
| `semantic_search` | Vector similarity search |
| `save_session` | Create new agent session |
| `save_memory` | Store memory entry |
| `summarize_repo` | Generate repository summary |
| `get_architecture_summary` | Code structure analysis |
| `get_related_files` | Find connected code files |
| `get_recent_changes` | Git commit history |
| `get_git_summary` | Git repository status |
| `list_skills` / `load_skill` | Skills system |
| `run_skill_command` | Execute skill commands |

---

## Configuration

### `contexthub.config.js`

```javascript
module.exports = {
  // Auto-start MCP server on shell load
  autoStart: true,
  
  // Auto-save commands to memory
  autoSave: true,
  
  // MCP server port
  port: 3000,
  
  // Vector search dimensions
  vectorDimension: 1536,
  
  // Context injection settings
  contextInjection: {
    maxTokens: 4000,
    includeRecent: 5,
    includeRelated: true
  }
};
```

---

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/contexthub/contexthub.git
cd contexthub

# Install dependencies
npm install

# Build all packages
npm run build

# Run CLI
node packages/cli/dist/index.js --help
```

### Project Structure

| Package | Purpose |
|---------|---------|
| `@contexthub/core` | Core API — sessions, memories, storage |
| `@contexthub/vector-engine` | Embedding generation & similarity search |
| `@contexthub/repo-parser` | AST parsing & code analysis |
| `@contexthub/git-integration` | Git operations via simple-git |
| `@contexthub/mcp-server` | MCP protocol implementation |
| `@contexthub/context-injector` | Smart context retrieval |
| `@contexthub/agent-connectors` | Claude Code, Cursor adapters |

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

---

## Skills System

Skills extend ContextHub with custom commands:

```typescript
// Example skill: debug
{
  name: 'debug',
  triggers: ['bug', 'error', 'issue'],
  commands: [
    {
      name: 'find-similar',
      description: 'Find similar past bugs',
      run: async (args, ctx) => {
        return "Found 3 related bug fixes...";
      }
    }
  ]
}
```

---

## Security & Privacy

- **Local-First** — All data stored in `.contexthub/` directory
- **No Cloud Sync** — Data never leaves your machine unless you opt in
- **Privacy-Focused** — No telemetry or tracking
- **GitIgnored** — `.contexthub/` is automatically gitignored

---

## Roadmap

- [ ] Web Dashboard for memory visualization
- [ ] Electron desktop app with system tray
- [ ] WebSocket transport for MCP
- [ ] Cloud sync with E2E encryption
- [ ] Team collaboration features
- [ ] Advanced skill marketplace

---

## Contributing

Contributions welcome! Please read our Contributing Guide and submit PRs.

## License

MIT © ContextHub Contributors

---

<p align="center">
  <strong>Built for developers who want AI that actually understands their code.</strong>
</p>