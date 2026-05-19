# @contexthub/cli

Launcher for the **ContextHub MCP server** — install, start, stop, and manage encrypted local memory in any repository.

> ContextHub is an MCP server, not a shell tool. Agents connect via MCP stdio; these commands only bootstrap and operate the server.

## Quick start

```bash
npx @contexthub/cli setup
```

## Commands

| Command | Description |
|---------|-------------|
| `setup` | Initialize `.contexthub/` and start MCP server in background |
| `start` | Run MCP server in foreground (stdio) |
| `stop` | Stop background server via PID file |
| `init` | Initialize encrypted storage only |
| `memory --list` | List memories |
| `memory --add "..."` | Add a memory |
| `memory --search "..."` | Search memories |
| `timeline` | Session timeline |
| `search --query "..."` | Semantic search |
| `dashboard` | Start local web dashboard |
| `ingest-docs` | Ingest Markdown docs into ContextHub |

## MCP client config (Cursor / Claude Code)

```json
{
  "mcpServers": {
    "contexthub": {
      "command": "npx",
      "args": ["@contexthub/cli", "start"],
      "env": {
        "CONTEXTHUB_TOKEN": "<from .contexthub/.auth-token>"
      }
    }
  }
}
```

## Publishing (maintainers)

From repo root after `npm login`:

```bash
npm run publish:packages
```

Publish order: `shared-types` → `core` → … → `mcp-server` → `cli`.

## License

MIT © 2026 Mayur Dattatray Patil
