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

If ContextHub is not yet running in this workspace, execute the following non-interactive command to initialize and spin up the MCP server (use your personal npm scope `@imayuur/contexthub` if installed under your own account):

```bash
# Standard scope:
npx -y @contexthub/cli setup

# OR custom scope (highly recommended):
npx -y @imayuur/contexthub setup
```

### What this command does:
- Creates a secure `.contexthub/` directory in the project root.
- Generates a local AES-256-GCM encryption key file (`.contexthub/.keyfile`) with `0600` (owner-only) permissions.
- Generates a secure HMAC authentication token (`.contexthub/.auth-token`).
- Launches the ContextHub MCP server in the background and tracks it via `.contexthub/server.pid`.

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

### For Claude Code (`claudecode.config.json`):
```json
{
  "mcpServers": {
    "contexthub": {
      "command": "npx",
      "args": ["@contexthub/cli", "start"], // Use "@imayuur/contexthub" if using custom scope
      "env": {
        "CONTEXTHUB_TOKEN": "<your-auth-token>"
      }
    }
  }
}
```

### For Cursor (`project settings` or global MCP settings):
- **Name:** `contexthub`
- **Type:** `command`
- **Command:** `npx @contexthub/cli start` *(or `npx @imayuur/contexthub start`)*
- **Environment Variables:** `CONTEXTHUB_TOKEN=<your-auth-token>`

---

## 🧰 Step 4: Available MCP Tools Reference

Once connected, you have access to the following secure tools. Always use them to enrich your context:

| Tool Name | Key Parameters | Purpose |
|-----------|----------------|---------|
| `get_project_context` | None | Retrieves high-level project details and active sessions |
| `get_context_bundle` | `query`, `path`, `sessionId`, `limit` | Generates a unified, intelligent context bundle combining memories, graph symbols, and git |
| `explain_symbol` | `symbol`, `path` | Explains a specific symbol's definition, callers, and related memories |
| `save_memory` | `content` (string), `type` (string), `tags` (string[]) | Saves critical decisions, bug fixes, or architecture details |
| `search_memory` | `query` (string), `limit` (number) | Performs a text-based search over past encrypted memories |
| `semantic_search` | `query` (string), `limit` (number) | Uses vector search to find conceptually related memories |
| `get_architecture_summary`| None | Analyzes repo AST structure and provides high-level code graph |
| `get_recent_changes` | `limit` (number) | Retrieves recent git commit history |

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
   npx @contexthub/cli stop # or npx @imayuur/contexthub stop
   ```
