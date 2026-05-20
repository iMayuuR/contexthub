# ContextHub Quick Guide

---

## Installation

### One-command setup (recommended)

```bash
# Standard scope:
npx @contexthub/cli setup

# OR custom scope:
npx @imayuur/contexthub setup
```

### After setup:
1. ContextHub creates encrypted storage in `.contexthub/`
2. MCP server starts in background with PID tracking
3. Encryption key + auth token auto-generated
4. **Secure auto-memory** — agent rules + Cursor hooks installed (see below)
5. No shell modification — your `.bashrc`/`.zshrc` is untouched

### Secure auto-memory (hands-free)

After `setup`, agents are instructed to call MCP tools automatically:

| Step | MCP tool |
|------|----------|
| Session start | `ensure_session` |
| Before work | `get_project_context` |
| After each meaningful turn | `record_turn` |
| Session end | `end_session` |

**Installed files:** `.cursor/rules/`, `.cursor/mcp.json`, `.cursor/hooks/`, `AGENTS.md`, `CLAUDE.md`, `.contexthub/agent-policy.md`

Secrets are auto-redacted; storage is AES-256-GCM encrypted.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `contexthub setup` | Full setup with MCP + encrypted storage + agent rules |
| `contexthub init` | Initialize ContextHub in current repo |
| `contexthub start --port 3000` | Start MCP server manually |
| `contexthub stop` | Stop MCP server cleanly |
| `contexthub memory --list` | List all memories |
| `contexthub memory --add "note"` | Add a memory manually |
| `contexthub memory --search "query"` | Search memories |
| `contexthub memory --list --type bugfix` | Filter by type |
| `contexthub timeline --limit 20` | View sessions |
| `contexthub search --query "..." --limit 5` | Semantic search |
| `contexthub query "text"` | Unified RRF query (memory + graph + git) |
| `contexthub context --query "text"` | Generate intelligent context bundle |
| `contexthub watch [path]` | Incremental file watcher (graph + embeddings) |
| `contexthub dashboard --port 3847` | Launch interactive web dashboard |
| `contexthub ingest-docs` | Ingest Markdown documentation |
| `contexthub report` | Generate `GRAPH_REPORT.md` |
| `contexthub export-graph` | Export code graph to standalone HTML |
| `contexthub compact --archive-age 30` | Merge + archive old memories |
| `contexthub export-memories` | Export encrypted portable bundle |
| `contexthub doctor` | Run health diagnostics |
| `contexthub status` | View memory and graph status |
| `contexthub benchmark` | Run performance benchmarks |
| `contexthub ci` | Non-interactive CI diagnostics |
| `contexthub blast-radius <files>` | Compute transitive blast radius |

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

> Dashboard binds to `127.0.0.1` only — never exposed to network.

---

## Memory Types

- `prompt` — User query
- `response` — AI response
- `summary` — Session summary
- `decision` — Architectural decision
- `architecture` — Design/structure
- `bugfix` — Bug and fix
- `manual` — User notes
- `commit` — Git commit record

---

## MCP Integration

AI agents connect to ContextHub via **stdio MCP transport** to:
- Query encrypted memories and context
- Save interactions (auto-sanitized and encrypted)
- Access repo intelligence, code graph, and git history

---

## Security

| Feature | Details |
|---------|---------|
| 🔐 **Encryption** | AES-256-GCM at rest for all data |
| 🛡️ **Auto-Redaction** | API keys, tokens, passwords auto-detected |
| 🚫 **No Shell Hooks** | No `.bashrc`/`.zshrc` modification |
| ✅ **Input Validation** | All parameters sanitized |
| 🔑 **Auth Support** | Optional `CONTEXTHUB_TOKEN` for MCP auth |
| 🌐 **Localhost Dashboard** | Dashboard bound to `127.0.0.1` only |

```bash
# Optional: Enable authentication
export CONTEXTHUB_TOKEN=your-secret-token

# Optional: Custom encryption key
export CONTEXTHUB_KEY=your-strong-passphrase
```

See [SECURITY.md](SECURITY.md) for the full security scan report (26 findings, all fixed).

---

## Stopping

```bash
# Clean shutdown (recommended)
contexthub stop

# Or manually via PID file
cat .contexthub/server.pid
kill <PID>
```

---

## Uninstall

```bash
# Stop the server
contexthub stop

# Remove ContextHub data
rm -rf .contexthub

# That's it — no shell profiles to clean up!
```