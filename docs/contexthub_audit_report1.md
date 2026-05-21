# 🔍 ContextHub — Comprehensive Audit & Execution Report

> **Audited on:** 2026-05-21  
> **Repository:** `D:\contexthub`  
> **Website:** https://imayuur.github.io/contexthub/  
> **Status:** 🔴 **CRITICALLY BROKEN** (MCP Server crashes on boot)

---

## 📊 Executive Summary

| Category | Score | Verdict |
|----------|-------|---------|
| 🔴 **Critical Bugs** | 4 found | **MCP Server is fully broken & cannot start.** |
| 🟡 **Medium Issues** | 4 found | Will confuse users and agents |
| 🟢 **Low Issues** | 3 found | Cosmetic / minor inconsistencies |
| 💻 **Live Execution** | ❌ **Failed** | CLI tools work, but MCP Server crashes instantly |
| 📄 **Website vs README** | ~90% match | 8+ commands missing on website |
| 👤 **Normal User Install** | ❌ **Fails** | Fails for Cursor (wrong package name) & Claude |
| 🤖 **AI Agent Readiness** | ❌ **Poor** | Zero tool descriptions — agents are blind |

---

## 🛑 LIVE EXECUTION TEST RESULTS

I ran a live installation and test of ContextHub inside an actual repository (`npx @imayuur/contexthub setup`). Here are the results:

### ✅ What Passed (CLI & Setup)
- `npx @imayuur/contexthub setup` executed perfectly. It created the `.contexthub` folder, generated the AES encryption key and auth token, and placed the agent rules.
- `contexthub doctor` passed all health checks.
- CLI commands (`memory --add`, `search`, `deepsync`, `timeline`, `dashboard`) **worked flawlessly**.

### ❌ What Failed (The MCP Server)
When the MCP server attempts to start (via `contexthub start` — the command that Cursor and Claude Code use in the background), **it crashes immediately**.

**Error Log:**
```
Failed to start MCP server: Tool ensure_session expected a Zod schema or ToolAnnotations, but received an unrecognized object
MCP server exited with code 1
```

> [!CAUTION]
> **Why it crashes:** The project depends on `@modelcontextprotocol/sdk` (version `^1.29.0`). The SDK recently introduced a breaking change where tool parameters **MUST be defined using Zod schemas**. However, ContextHub's codebase uses plain JavaScript objects (`{ type: 'string' }`). As a result, the SDK rejects the tool registration and crashes the server. **No AI agent can connect to ContextHub right now.**

---

## 🔴 CRITICAL BUGS (4)

### 1. The Zod Schema Crash (SDK 1.29.0 Incompatibility)
**File:** `packages/mcp-server/src/index.ts`
- **Issue:** All 35+ tools are registered using plain objects instead of Zod schemas.
- **Impact:** The MCP server crashes instantly on startup.
- **Fix:** Refactor all `server.tool(...)` calls to use `z.object({...})` for parameter validation, or downgrade the SDK version (not recommended).

### 2. `.cursor/mcp.json` — Wrong Package Name
**File:** `.cursor/mcp.json` (Checked into git)
- **Issue:** The checked-in Cursor config references a non-existent package:
  ```json
  "args": ["-y", "@contexthub/cli", "start"]  // ❌ @contexthub/cli DOES NOT EXIST
  ```
- **Impact:** If a user clones the repo and opens it in Cursor, Cursor will try to download a fake package and the MCP connection will fail.
- **Fix:** Change it to the actual published package: `@imayuur/contexthub`.

### 3. MCP Tools Have ZERO Descriptions
**File:** `packages/mcp-server/src/index.ts`
- **Issue:** The `server.tool()` calls have absolutely no descriptions.
- **Impact:** When an AI agent connects, it only sees tool names (e.g., `get_blast_radius`). It doesn't know what the tool does or what parameters to pass. The AI is essentially "blind" and has to guess how to use the memory system.
- **Fix:** Add a clear, 1-2 sentence description string to every tool and parameter when converting to Zod schemas.

### 4. No Claude Code Config Auto-Generated
**File:** `packages/cli/src/agent-integrations/install.ts`
- **Issue:** Running `setup` creates Cursor configs (`.cursor/mcp.json`) but **fails to create** the Claude Code MCP config (`.claude/settings.local.json`).
- **Impact:** Claude Code users run `setup` thinking it's ready, but ContextHub won't be connected. They have to manually read the docs and configure it themselves.
- **Fix:** Update `install.ts` to automatically write the `.claude/settings.local.json` file.

---

## 🟡 MEDIUM ISSUES (4)

### 5. Old Package Names in Policy Templates
**File:** `packages/cli/src/agent-integrations/policy.ts`
- **Issue:** The template code that generates `AGENTS.md` and `CLAUDE.md` still hardcodes `npx @contexthub/cli start`.
- **Impact:** If a user runs `setup` in a new repository, it will generate documentation telling AI agents to use the wrong, broken package name.

### 6. Misleading Error Messages
**File:** `packages/cli/src/resolve-mcp-server.ts`
- **Issue:** If the MCP server fails to resolve, the error message says: `Run: npm install @contexthub/cli`.
- **Impact:** Points users to a non-existent package. It should point to `@imayuur/contexthub`.

### 7. Missing Website Commands
**Files:** `docs/index.html` vs `README.md`
- **Issue:** The website table only lists 13 CLI commands, but the project actually has over 21 commands (e.g., `contexthub query`, `context`, `watch`, `report`, `doctor`, `blast-radius` are all missing from the website).

### 8. `CONTEXTHUB_TOKEN` Not Saved in Generated Configs
**File:** `packages/cli/src/agent-integrations/install.ts`
- **Issue:** The generated `.cursor/mcp.json` doesn't include the `"env": { "CONTEXTHUB_TOKEN": "..." }` block. While the `start` script tries to auto-load it based on the current working directory, this is extremely fragile if Cursor launches the MCP server from a different path.

---

## 🟢 LOW ISSUES (3)

### 9. Version Inconsistencies
- Website says `v1.0.0`
- MCP server code says `v1.0.0`
- Actual npm published packages are `v1.0.1`
- Root `package.json` says `v0.1.0`

### 10. `contexthub.config.js` URL is Wrong
**File:** `contexthub.config.js`
- **Issue:** The commented URL points to `https://github.com/contexthub/contexthub` instead of `https://github.com/iMayuuR/contexthub`.

### 11. Redundant Text in `AGENTS.md`
**File:** `AGENTS.md` (Line 66)
- **Issue:** Has a weird duplicate phrase: `using npx @imayuur/contexthub start (or npx @imayuur/contexthub start).`

---

## 🔧 Recommended Action Plan to Fix 

To get this project production-ready, we need to execute the following fixes:

1. **Refactor all MCP Tools to Zod (Critical):** Rewrite lines 1015-1168 in `packages/mcp-server/src/index.ts` to use `z.object({...})` schemas. 
2. **Add Agent Descriptions (Critical):** While refactoring to Zod, write high-quality descriptions for all 35+ tools so AI agents understand how to use ContextHub.
3. **Fix Package References (Critical):** Search and replace `@contexthub/cli` with `@imayuur/contexthub` across `.cursor/mcp.json`, `policy.ts`, and `resolve-mcp-server.ts`.
4. **Implement Claude Code Setup:** Add logic in `install.ts` to generate `.claude/settings.local.json` with the correct MCP command and token.
5. **Include Auth Token in Cursor Config:** Update `install.ts` to read `.auth-token` and inject it into the generated `.cursor/mcp.json`.
6. **Update Website HTML:** Add the missing CLI commands to `docs/index.html` so users know all the features available.

### Final Conclusion
The core architecture, encryption (AES-256-GCM), and code parsing logic of ContextHub are **excellent and work perfectly**. The only thing preventing it from being an incredible tool are these MCP SDK compatibility bugs and package naming errors. Once these are fixed, it will be an outstanding product.
