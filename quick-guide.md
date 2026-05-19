# ContextHub Quick Guide

---

## Installation

### One-command setup (recommended)

```bash
# For any Node.js project
npx @contexthub/cli setup

# Or for local development
git clone https://github.com/iMayuuR/contexthub.git
cd contexthub
npm install && npm run build
node packages/cli/dist/index.js setup
```

### After setup:
1. ContextHub creates encrypted storage in `.contexthub/`
2. MCP server starts in background with PID tracking
3. Encryption key + auth token auto-generated
4. No shell modification — your `.bashrc`/`.zshrc` is untouched

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `contexthub init` | Initialize ContextHub in current repo |
| `contexthub setup` | Full setup with MCP + encrypted storage |
| `contexthub memory --list` | List all memories |
| `contexthub memory --add "note"` | Add a memory manually |
| `contexthub memory --search "query"` | Search memories |
| `contexthub memory --list --type bugfix` | Filter by type |
| `contexthub timeline --limit 20` | View sessions |
| `contexthub search --query "..." --limit 5` | Semantic search |
| `contexthub start --port 3000` | Start MCP server manually |
| `contexthub stop` | Stop MCP server cleanly |

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
- Access repo intelligence and code analysis

---

## Security

| Feature | Details |
|---------|---------|
| 🔐 **Encryption** | AES-256-GCM at rest for all data |
| 🛡️ **Auto-Redaction** | API keys, tokens, passwords auto-detected |
| 🚫 **No Shell Hooks** | No `.bashrc`/`.zshrc` modification |
| ✅ **Input Validation** | All parameters sanitized |
| 🔑 **Auth Support** | Optional `CONTEXTHUB_TOKEN` for MCP auth |

```bash
# Optional: Enable authentication
export CONTEXTHUB_TOKEN=your-secret-token

# Optional: Custom encryption key
export CONTEXTHUB_KEY=your-strong-passphrase
```

See [SECURITY.md](SECURITY.md) for the full security scan report.

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