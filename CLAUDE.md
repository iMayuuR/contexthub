# ContextHub - Development Guide

## Project Overview

ContextHub is a **persistent AI memory and context orchestration layer** for coding agents. It provides automatic context injection, semantic memory search, and repository intelligence for AI coding assistants like Claude Code, Cursor, and any MCP-compatible agent.

### Architecture

```
contexthub/
├── apps/
│   ├── web/              # Next.js dashboard (planned)
│   └── desktop/           # Electron app (planned)
├── packages/
│   ├── core/              # Core ContextHub engine - memory storage and session management
│   ├── cli/               # Command-line interface with init, setup, memory, timeline commands
│   ├── mcp-server/        # MCP server providing tools for AI agent integration
│   ├── shared-types/      # TypeScript interfaces (Session, MemoryEntry, etc.)
│   ├── memory-engine/     # Advanced memory algorithms
│   ├── vector-engine/     # Embeddings and similarity search
│   ├── repo-parser/       # Tree-sitter based code analysis
│   ├── context-injector/  # Context retrieval and prompt enhancement
│   ├── git-integration/   # Git history and commit tracking
│   ├── agent-connectors/  # Adapters for different AI agents
│   └── skills/            # Skills system for reusable AI expertise
└── .contexthub/           # Per-repo storage (created at runtime)
```

## Development Commands

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Development mode
npm run dev

# Initialize ContextHub in a repo
node packages/cli/dist/index.js init

# Run memory operations
node packages/cli/dist/index.js memory --list
node packages/cli/dist/index.js memory --add "Note here"

# Setup automatic memory saving
node packages/cli/dist/index.js setup

# Start MCP server
node packages/cli/dist/index.js start --port 3000
```

## Key Components

### Core Package (`packages/core`)
- `ContextHubCore` - Main entry point
- `MemoryStorage` - JSON file-based storage for sessions and memories
- Methods: `createSession`, `endSession`, `getSessions`, `saveMemory`, `searchMemories`, `saveProjectMetadata`, `getProjectMetadata`

### CLI Package (`packages/cli`)
Commands:
- `init` - Initialize ContextHub in repository
- `setup` - Setup automatic operation with MCP server
- `memory` - Manage memories (--list, --add, --search, --type)
- `timeline` - View session timeline
- `search` - Semantic search across memories
- `start` - Start MCP server

### MCP Server (`packages/mcp-server`)
Provides MCP tools:
- `get_project_context` - Get project metadata and recent sessions
- `search_memory` - Text search memories
- `save_session` - Create new session
- `summarize_repo` - Generate repo summary
- `get_related_files` - Find related files
- `get_recent_changes` - Get git recent changes
- `get_architecture_summary` - Analyze codebase structure
- `semantic_search` - Vector similarity search
- `update_knowledge_graph` - Update code knowledge graph
- `list_skills` / `load_skill` - Skill management
- `get_git_summary` - Git repository summary

### Shared Types (`packages/shared-types`)
- `Session` - Agent session with timing and metadata
- `MemoryEntry` - Memory with id, type, content, timestamp, tags, optional embedding
- `ProjectMetadata` - Project info (name, language, framework, timestamps)
- `VectorSearchResult` - Search result with id, score, and memory metadata
- `KnowledgeGraphNode` / `KnowledgeGraphEdge` - Code relationship graph
- `ParsedFile`, `Symbol`, `ImportExport` - Code structure types

## Adding Dependencies

When adding dependencies to packages:
```bash
cd packages/<package-name>
npm install <dependency>
```

Dependencies between local packages should use `file:../<package>` format in package.json.

## Adding New Commands

To add a new CLI command:
1. Create file in `packages/cli/src/commands/<command-name>.ts`
2. Export async function `commandName(options)`
3. Import in `packages/cli/src/index.ts`
4. Add command definition with commander

## Adding MCP Tools

Add to `packages/mcp-server/src/index.ts`:
```typescript
async function myToolHandler(args) {
  const ctx = await getCore();
  // Implementation
  return result;
}

server.tool('my_tool', {
  param: { type: 'string' }
}, myToolHandler);
```

## Type Changes

When modifying shared types in `packages/shared-types/src/index.ts`:
1. Rebuild shared-types first: `npm run build --workspace=packages/shared-types`
2. Rebuild dependent packages
3. All consumers use `import type` for type-only imports to avoid runtime issues

## File Watching (Git Integration)

The git-integration package uses `simple-git` for repository operations. 
File watching for automatic change tracking is planned via chokidar.

## Testing

Tests are in `test-init/` directory. Run manually:
```bash
npm run dev
# or
node packages/cli/dist/index.js <command>
```

---

*Documentation auto-generated for Claude Code*