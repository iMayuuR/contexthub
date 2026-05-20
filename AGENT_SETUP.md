# ContextHub AI Agent Integration Prompt & Setup Guide

> **File Purpose:** Feed this file to any Agentic AI (e.g., Claude Code, Cursor, Windsurf, Copilot) as a system prompt or instruction sheet. It allows the AI to immediately understand, install, configure, and securely use ContextHub in any workspace.

---

## 🤖 System Instructions for the AI Agent

You are working in a project workspace equipped with **ContextHub**—a local-first, privacy-focused, and fully encrypted persistent memory and context orchestration layer.

Your objective is to:
1. **Initialize and setup ContextHub** if not already done.
2. **Securely connect** to the local ContextHub Model Context Protocol (MCP) server.
3. **Use the available memory and repo-intelligence tools** to maintain conversational memory across sessions and understand codebase architecture.
4. **Follow strict security boundaries** to keep user credentials, API keys, and private files secure.

---

## 🛠️ Step 1: Automated Installation & Initialization

You can set up ContextHub either **Globally** (for use across all your repositories) or as a **Single-Repo local setup** (confined to this project only).

### Option A: Single Repository Installation (Recommended for Teams)
Installs ContextHub as a local devDependency within the current repository. Perfect for project-level isolation.
```bash
# 1. Install locally in the project root
npm install --save-dev @imayuur/contexthub

# 2. Run the local setup
npx contexthub setup
```

### Option B: Global Installation (Universal Access)
Installs ContextHub globally on your system. Best if you want to use it across multiple different repositories.
```bash
# 1. Install globally
npm install -g @imayuur/contexthub

# 2. Run setup in the project root
contexthub setup
```

### Option C: Instant Execution (No Local Install)
If you do not want to install it locally or globally, run instantly via `npx`:
```bash
npx -y @imayuur/contexthub setup
```

### What the `setup` command does:
- Creates a secure `.contexthub/` directory in the project root.
- Generates a local AES-256-GCM encryption key file (`.contexthub/.keyfile`) with `0600` (owner-only) permissions.
- Generates a secure HMAC authentication token (`.contexthub/.auth-token`).
- Launches the ContextHub MCP server in the background and tracks it via `.contexthub/server.pid`.
- Installs agent rule files: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.cursor/mcp.json`, `.cursor/hooks/`.

---

## 🧠 Step 1.5: DeepSync — Build Complete Repo Intelligence

After setup, run DeepSync once to give the AI agent total codebase awareness:

```bash
npx @imayuur/contexthub deepsync
```

### What this does:
- Parses all source files across 15+ languages → builds a knowledge graph of symbols and imports
- Ingests all markdown documentation → stores in searchable semantic memory
- Mines git commit history → identifies hot files and recent focus areas
- Generates vector embeddings for semantic search across all memories
- Writes a rich `DEEPSYNC.md` intelligence report to `.contexthub/`

> **Auto-sync:** After the initial scan, the knowledge graph is automatically updated on every `ensure_session` call. Only changed files are re-analyzed — zero manual effort.

---

## 🔑 Step 2: Retrieve Authentication and Configuration

To communicate with the ContextHub MCP server, you need to read the generated token and use it for authentication.

Execute these commands to read configurations:

```bash
# Retrieve the secure HMAC auth token
cat .contexthub/.auth-token

# (Optional) Verify the background process is running
cat .contexthub/server.pid
```

Use the retrieved token to set the environment variable:
```bash
export CONTEXTHUB_TOKEN="<retrieved-token-value>"
```

---

## 🔌 Step 3: MCP Connection Configuration

Add ContextHub as an MCP server in your configuration.

### For Claude Code (`.claude/settings.json`):
```json
{
  "mcpServers": {
    "contexthub": {
      "command": "npx",
      "args": ["@imayuur/contexthub", "start"],
      "env": {
        "CONTEXTHUB_TOKEN": "<your-auth-token>"
      }
    }
  }
}
```

### For Cursor (project settings or global MCP settings):
- **Name:** `contexthub`
- **Type:** `command`
- **Command:** `npx @imayuur/contexthub start`
- **Environment Variables:** `CONTEXTHUB_TOKEN=<your-auth-token>`

---

## 🧰 Step 4: Available MCP Tools Reference

Once connected, you have access to the following secure tools. Always use them to enrich your context:

### Session & Memory Tools

| Tool Name | Key Parameters | Purpose |
|-----------|----------------|---------|
| `ensure_session` | `agentName` | Start or resume a session |
| `record_turn` | `prompt`, `response` | Save a conversation turn |
| `end_session` | `sessionId` | End the active session |
| `get_project_context` | None | Retrieves project details and active sessions |
| `get_context_bundle` | `query`, `path`, `sessionId`, `limit` | Unified context bundle combining memories, graph, and git |
| `save_memory` | `content`, `type`, `tags` | Save decisions, bugs, or architecture notes |
| `search_memory` | `query`, `limit` | Text search over encrypted memories |
| `semantic_search` | `query`, `limit` | Vector similarity search |
| `search_memory_by_code` | `code` | Find memories related to code snippets |
| `contexthub_query` | `query`, `limit` | Unified RRF search (memory + graph + git) |
| `explain_symbol` | `symbol`, `path` | Explain a symbol's definition and callers |

### Code Graph & Repo Tools

| Tool Name | Key Parameters | Purpose |
|-----------|----------------|---------|
| `get_code_graph_stats` | None | Graph node/edge counts and metrics |
| `get_related_symbols` | `symbol` | Find related symbols via graph |
| `get_blast_radius` | `filePath`, `depth` | Transitive impact of file changes |
| `trace_code_path` | `from`, `to` | Trace dependency path between files |
| `update_knowledge_graph` | None | Refresh code graph + generate report |
| `get_god_nodes` | None | Find highest-connectivity hub files |
| `get_graph_communities` | None | Detect connected components |
| `diff_code_graph` | None | Diff current graph vs last session |
| `what_changed_since_session` | `sessionId` | Changes since a specific session |
| `summarize_repo` | None | Generate repository summary |
| `get_architecture_summary` | None | AST-based codebase structure |
| `get_related_files` | `path` | Find connected code files |
| `get_recent_changes` | `limit` | Recent git commit history |
| `get_git_summary` | None | Git repository status |
| `get_memories_for_commit` | `commitHash` | Memories linked to a commit |

### Docs & Skills Tools

| Tool Name | Key Parameters | Purpose |
|-----------|----------------|---------|
| `ingest_docs` | `patterns` | Ingest markdown docs into vector engine |
| `search_docs` | `query` | Search ingested documentation |
| `ingest_pdf` | `filePath` | Extract text from PDF (requires `CONTEXTHUB_ENABLE_PDF=1`) |
| `list_skills` | None | List available built-in skills |
| `load_skill` | `name` | Load a skill |
| `run_skill_command` | `skill`, `command` | Execute a skill command |

---

## 📊 Step 5: Dashboard (Interactive Web UI)

Launch the local interactive dashboard to visually explore memories and codebase topology:

```bash
# Launch dashboard (localhost only, port 3847)
npx @imayuur/contexthub dashboard

# Custom port
npx @imayuur/contexthub dashboard --port 4000
```

Opens at `http://127.0.0.1:3847`. Features:
- **Memory Feed** — browse encrypted memories with tags and timestamps
- **Intelligent Query** — unified search across memories, graph, and git
- **Topology Graph** — interactive force-directed Vis.js graph of codebase dependencies

> Dashboard binds to `127.0.0.1` only — never exposed to the network.

---

## 🚨 Crucial Security Rules for the AI Agent

As an agentic AI, you **MUST** strictly adhere to the following security protocols:

1. **NEVER Read or Leak the Encryption Key:** Do not view or output the contents of `.contexthub/.keyfile`. This key is generated locally and must never be exposed or transmitted.
2. **Sanitize Secrets Before Saving:** Although ContextHub has built-in auto-redaction, you must proactively redact any raw passwords, API keys (e.g. `sk-...`), or private credentials from the `content` parameter before calling `save_memory`.
3. **No File Traversal:** Do not attempt to query files outside the workspace directory root. All paths supplied to ContextHub tools must be relative to the repository root.
4. **Skip Sensitive Files:** Never parse or scan `.env`, `.pem`, `.key`, `id_rsa`, or any secrets file. ContextHub's `repo-parser` excludes these by default; do not bypass this restriction.
5. **No Shell Profile Modifying Hooks:** Do not write shell startup hooks or traps to the user's terminal profiles (`.zshrc`, `.bashrc`). ContextHub operates strictly via the clean background server managed by `contexthub stop` and `contexthub start`.
6. **Graceful Daemon Shutdown:** To stop the server at the end of operations, simply run:
   ```bash
   npx @imayuur/contexthub stop
   ```
