# ContextHub Quick Guide

---

## Installation

### One-command setup (recommended)

```bash
# For any Node.js project
npx @contexthub/cli setup

# Or for local development
git clone https://github.com/contexthub/contexthub.git
cd contexthub
npm install && npm run build
node packages/cli/dist/index.js setup
```

### After setup:
1. Restart your terminal
2. ContextHub auto-starts on each shell load
3. MCP server runs on `http://localhost:3000`

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `contexthub init` | Initialize ContextHub in current repo |
| `contexthub setup` | Full auto-setup with MCP + memory saving |
| `contexthub memory --list` | List all memories |
| `contexthub memory --add "note"` | Add a memory manually |
| `contexthub memory --search "query"` | Search memories |
| `contexthub memory --list --type bugfix` | Filter by type |
| `contexthub timeline --limit 20` | View sessions |
| `contexthub search --query "..." --limit 5` | Semantic search |
| `contexthub start --port 3000` | Start MCP server manually |

---

## Memory Types

- `prompt` - User query
- `response` - AI response
- `summary` - Session summary
- `decision` - Architectural decision
- `architecture` - Design/structure
- `bugfix` - Bug and fix
- `manual` - User notes

---

## MCP Integration

Any MCP-compatible AI agent can connect to `http://localhost:3000` to:
- Query memories and context
- Save interactions
- Access repo intelligence

---

## Configuration

Edit `contexthub.config.js` in your project root:

```javascript
module.exports = {
  autoStart: true,
  autoSave: true,
  port: 3000
};
```

---

## Stopping

```bash
# Find MCP server process
pgrep -f "packages/cli/dist/index.js" | head -1

# Kill it (or restart terminal)
kill <PID>
```

---

## Uninstall

```bash
# Remove ContextHub data
rm -rf .contexthub

# Remove shell hook from .bashrc/.zshrc
# (remove the ContextHub section)
```