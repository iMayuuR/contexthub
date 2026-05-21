# 🔍 ContextHub — Full Project Audit Report

> **Audited on:** 2026-05-21  
> **Repo:** `D:\contexthub`  
> **Website:** https://imayuur.github.io/contexthub/  
> **npm package:** `@imayuur/contexthub` (CLI) + `@imayuur/contexthub-mcp-server`  
> **GitHub:** https://github.com/iMayuuR/contexthub

---

## Executive Summary

| Category | Score | Verdict |
|----------|-------|---------|
| 🔴 **Critical Bugs** | 3 found | Must fix before any user tries to install |
| 🟡 **Medium Issues** | 4 found | Will confuse users and agents |
| 🟢 **Low Issues** | 3 found | Cosmetic / minor |
| 📄 **Website vs README** | ~90% match | Some commands missing on website |
| 👤 **Normal User Install** | ⚠️ **Risky** | Will fail for Cursor (wrong package name in config) |
| 🤖 **AI Agent Understanding** | ❌ **Poor** | Zero tool descriptions — agents are blind |

---

## 🔴 CRITICAL Issues (3)

### 1. `.cursor/mcp.json` — Wrong Package Name (INSTALL WILL FAIL)

**File:** [.cursor/mcp.json](file:///D:/contexthub/.cursor/mcp.json)

The checked-in Cursor MCP config references a **non-existent package**:

```diff
{
  "mcpServers": {
    "contexthub": {
      "command": "npx",
      "args": [
        "-y",
-       "@contexthub/cli",       ← ❌ DOESN'T EXIST on npm
+       "@imayuur/contexthub",   ← ✅ Correct published package
        "start"
      ]
    }
  }
}
```

> [!CAUTION]
> Any user who clones the repo and opens it in Cursor will get an **immediate MCP connection failure** because `@contexthub/cli` doesn't exist. The `install.ts` code at [install.ts:83](file:///D:/contexthub/packages/cli/src/agent-integrations/install.ts#L83) generates the correct name (`@imayuur/contexthub`), but users who clone before running `setup` will hit the broken checked-in file.

---

### 2. MCP Tools Have ZERO Descriptions — AI Agents Are Blind

**File:** [packages/mcp-server/src/index.ts](file:///D:/contexthub/packages/mcp-server/src/index.ts#L1015-L1168)

All 35+ tools are registered **without any description**:

```typescript
// ❌ Current — NO description at all
server.tool('get_project_context', {}, safeHandler(getProjectContext));

server.tool('ensure_session', {
  agent: { type: 'string' },        // No parameter description either
  forceNew: { type: 'boolean', optional: true },
}, safeHandler(async ({ agent, forceNew }) => ensureSession(agent, Boolean(forceNew))));
```

The MCP SDK `server.tool()` supports a description parameter: `server.tool(name, description, schema, handler)` — but it's **never used** here.

> [!CAUTION]
> **Impact:** When an AI agent (Claude, Cursor, Copilot, etc.) discovers available MCP tools, it will **only see tool names** like `get_blast_radius` or `trace_code_path` with no explanation of what they do, what values to pass, or when to use them. The agent essentially has to **guess**. This is the single most impactful issue — without descriptions, the 35+ tools are nearly useless to agents.
>
> **Parameter schemas also lack descriptions.** For example, `agent: { type: 'string' }` doesn't tell the AI what agent name to pass.

---

### 3. No Claude Code MCP Config Auto-Generated

**File:** [packages/cli/src/agent-integrations/install.ts](file:///D:/contexthub/packages/cli/src/agent-integrations/install.ts)

The `setup` command installs:
- ✅ `.cursor/mcp.json` — Cursor MCP config (but wrong package name in the committed file)
- ✅ `.cursor/rules/` — Cursor auto-memory rules
- ✅ `AGENTS.md`, `CLAUDE.md` — Agent policy files
- ✅ `.claude/skills/contexthub/SKILL.md` — Claude skill
- ❌ **NO `.claude/settings.local.json` with MCP server entry**

The [.claude/settings.local.json](file:///D:/contexthub/.claude/settings.local.json) file only has permission entries but **no MCP server configuration**. Claude Code users must manually configure MCP — they can't just run `setup` and have it work.

---

## 🟡 MEDIUM Issues (4)

### 4. Policy Templates Use Old `@contexthub/cli` Package Name

**File:** [packages/cli/src/agent-integrations/policy.ts](file:///D:/contexthub/packages/cli/src/agent-integrations/policy.ts)

```
Line 74:  `npx @contexthub/cli start`  ← ❌ Wrong in AGENTS.md template
Line 86:  `npx @contexthub/cli start`  ← ❌ Wrong in CLAUDE.md template
```

> [!WARNING]
> The manually committed [AGENTS.md](file:///D:/contexthub/AGENTS.md#L66) was hand-fixed to use `@imayuur/contexthub`, but if a user runs `setup` in a **new repo**, the generated files will contain the old wrong package name from the template code.

---

### 5. `resolve-mcp-server.ts` Error Messages Reference Wrong Package

**File:** [packages/cli/src/resolve-mcp-server.ts](file:///D:/contexthub/packages/cli/src/resolve-mcp-server.ts#L14-L22)

```typescript
throw new Error(
  '@contexthub/mcp-server is not installed. Run: npm install @contexthub/cli'
  //  ❌ Should be: @imayuur/contexthub-mcp-server and @imayuur/contexthub
);
```

Both error messages tell users to install a package that doesn't exist.

---

### 6. `CONTEXTHUB_TOKEN` Not Included in Generated `.cursor/mcp.json`

**File:** [install.ts](file:///D:/contexthub/packages/cli/src/agent-integrations/install.ts#L80-L101)

The generated Cursor MCP config doesn't include the auth token:

```json
{
  "mcpServers": {
    "contexthub": {
      "command": "npx",
      "args": ["-y", "@imayuur/contexthub", "start"]
      // ❌ No "env": { "CONTEXTHUB_TOKEN": "..." }
    }
  }
}
```

The `start` command auto-loads the token from `.contexthub/.auth-token`, but this relies on `cwd` being the repo root. If Cursor spawns the process from a different directory, authentication will silently fail.

---

### 7. Website Missing Several CLI Commands

**Comparison:** [Website commands table](file:///D:/contexthub/docs/index.html#L228-L250) vs [README.md](file:///D:/contexthub/README.md#L100-L143) vs [quick-guide.md](file:///D:/contexthub/quick-guide.md#L41-L71)

| Command | README | Website | quick-guide |
|---------|--------|---------|-------------|
| `contexthub query "text"` | ✅ | ❌ Missing | ✅ |
| `contexthub context --query "text"` | ✅ | ❌ Missing | ✅ |
| `contexthub watch` | ✅ | ❌ Missing | ✅ |
| `contexthub report` | ❌ | ❌ | ✅ |
| `contexthub export-graph` | ❌ | ❌ | ✅ |
| `contexthub compact --archive-age 30` | ❌ | ❌ | ✅ |
| `contexthub export-memories` | ❌ | ❌ | ✅ |
| `contexthub status` | ❌ | ❌ | ✅ |
| `contexthub ci` | ❌ | ❌ | ✅ |
| `contexthub blast-radius <files>` | ❌ | ❌ | ✅ |
| `contexthub doctor` | ✅ | ❌ Missing | ✅ |
| `contexthub benchmark` | ✅ | ❌ Missing | ✅ |

> [!IMPORTANT]
> The website only shows **13 commands** in its table. The README shows **~20 commands**. The `quick-guide.md` is the most complete with **21 commands**. The website should match the quick-guide at minimum.

---

## 🟢 LOW Issues (3)

### 8. `contexthub.config.js` — Empty + Wrong URL

**File:** [contexthub.config.js](file:///D:/contexthub/contexthub.config.js)

```javascript
module.exports = {
  // ContextHub configuration
  // See https://github.com/contexthub/contexthub for options:
  //                        ↑ Wrong URL! Should be github.com/iMayuuR/contexthub
};
```

### 9. Version Mismatch — Website vs Packages

| Location | Version |
|----------|---------|
| Website hero badge | `v1.0.0` |
| MCP server `new McpServer({version})` | `1.0.0` |
| `packages/cli/package.json` | `1.0.1` |
| `packages/mcp-server/package.json` | `1.0.1` |
| Root `package.json` | `0.1.0` |

Minor inconsistency — the published packages are `1.0.1` but the website and server advertise `1.0.0`.

### 10. `AGENTS.md` Line 66 Has Redundant Duplicate

**File:** [AGENTS.md:66](file:///D:/contexthub/AGENTS.md#L66)

```
Supported: ... using `npx @imayuur/contexthub start` (or `npx @imayuur/contexthub start`).
```

Same command repeated in parentheses — looks like a leftover from renaming.

---

## 📊 Website vs README — Detailed Content Match

### ✅ Consistent Across Website + README

| Content | Website | README |
|---------|---------|--------|
| Install command: `npx @imayuur/contexthub setup` | ✅ | ✅ |
| DeepSync command: `npx @imayuur/contexthub deepsync` | ✅ | ✅ |
| Start command: `npx @imayuur/contexthub start` | ✅ | ✅ |
| Memory types (8 types) | ✅ Identical | ✅ |
| Security table | ✅ (more detailed on website) | ✅ |
| Architecture tree | ✅ (slightly condensed) | ✅ |
| Skills table | ✅ | ✅ |
| Agent setup steps | ✅ | ✅ |
| From source instructions | ✅ | ✅ |

### ❌ Inconsistencies

| Item | Website | README |
|------|---------|--------|
| MCP tools listed | 14 tools shown | 35+ listed with categories |
| `--port 3000` on start | ✅ | ✅ |
| Dashboard section | Mentioned in commands | Full section with screenshots |
| "From source" build step | `npm install && npm run build` | Same ✅ |
| Agent setup config | `claudecode.config.json` | `.claude/settings.json` ← different filename! |

> [!WARNING]
> Website says Claude Code config goes in `claudecode.config.json` (line 417 of index.html), but AGENT_SETUP.md says `.claude/settings.json`. The actual correct location is `.claude/settings.local.json` or `~/.claude.json`. This will confuse users.

---

## 👤 Normal User Install Assessment

### Can a user install in 5 minutes?

| Step | Time | Blocker? |
|------|------|----------|
| 1. `npx @imayuur/contexthub setup` | ~2 min | ✅ Works (if npm package exists) |
| 2. Cursor: MCP auto-configured | 0 min | ⚠️ **`.cursor/mcp.json` committed with wrong package name** |
| 3. Claude Code: Manual MCP config needed | ~3 min | ❌ Not auto-generated |
| 4. DeepSync: `npx @imayuur/contexthub deepsync` | ~2 min | ✅ Optional but recommended |
| 5. Verify: `contexthub doctor` | ~1 min | ✅ |

### Verdict: ⚠️ **3-5 minutes for Cursor IF the bugs are fixed. Claude Code needs manual steps.**

### Blockers for a first-time user:

1. **If they clone the repo** → `.cursor/mcp.json` has wrong package name → **instant failure**
2. **If they're on Claude Code** → no auto-config → they have to manually find and follow `AGENT_SETUP.md`
3. **Missing `-y` flag in some npx commands** → user gets prompted "Install package?" → confusion
4. **No `CONTRIBUTING.md`** exists despite README mentioning it

---

## 🤖 AI Agent Understanding Assessment

### Will an IDE AI agent understand ContextHub MCP tools?

| Aspect | Status | Impact |
|--------|--------|--------|
| Tool names | ✅ Descriptive (e.g., `get_blast_radius`) | Agent can guess purpose |
| Tool descriptions | ❌ **Completely absent** | Agent doesn't know what tools DO |
| Parameter descriptions | ❌ **Completely absent** | Agent doesn't know what to pass |
| Agent policy files | ✅ Well-written (`AGENTS.md`, `CLAUDE.md`) | Helps if agent reads them |
| Cursor auto-memory rules | ✅ Good `.mdc` rule | Tells Cursor workflow |
| MCP resources | ✅ `contexthub://policy` exists | Agent can fetch policy |
| Claude skill file | ✅ Generated at `.claude/skills/contexthub/SKILL.md` | Helps Claude agents |

### Verdict: ❌ **An AI agent will struggle significantly**

The agent policy files (`AGENTS.md`, `CLAUDE.md`) are excellent and explain the workflow well. But the **actual MCP tool interface** — which is what the agent directly interacts with — provides **zero guidance**. The agent sees:

```
Tool: ensure_session
Parameters: agent (string), forceNew (boolean, optional)
Description: (none)
```

Instead of:

```
Tool: ensure_session
Description: Start or resume a coding session. Call this at the beginning of every interaction.
Parameters:
  - agent (string): Agent identifier, e.g. "cursor", "claude-code", "copilot"
  - forceNew (boolean, optional): If true, always creates a new session instead of resuming
```

---

## 🔧 Recommended Fix Priority

### Must Fix (Before Any User Install)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 1 | Fix `.cursor/mcp.json` → `@imayuur/contexthub` | `.cursor/mcp.json` | 2 min |
| 2 | Add descriptions to all 35+ `server.tool()` calls | `packages/mcp-server/src/index.ts` | 2-3 hours |
| 3 | Fix `policy.ts` templates → `@imayuur/contexthub` | `packages/cli/src/agent-integrations/policy.ts` | 5 min |
| 4 | Fix `resolve-mcp-server.ts` error messages | `packages/cli/src/resolve-mcp-server.ts` | 5 min |

### Should Fix (Before Public Launch)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 5 | Auto-generate Claude Code MCP config in `setup` | `install.ts` | 30 min |
| 6 | Add missing commands to website | `docs/index.html` | 30 min |
| 7 | Fix Claude Code config filename on website | `docs/index.html` | 5 min |
| 8 | Include `CONTEXTHUB_TOKEN` in generated MCP configs | `install.ts` | 15 min |
| 9 | Fix `AGENTS.md` line 66 redundancy | `AGENTS.md` | 2 min |
| 10 | Fix `contexthub.config.js` URL | `contexthub.config.js` | 2 min |

---

## 📋 Overall Quality Score

| Category | Rating | Notes |
|----------|--------|-------|
| **Code Architecture** | ⭐⭐⭐⭐⭐ | Excellent monorepo, 14 well-organized packages |
| **Security** | ⭐⭐⭐⭐⭐ | AES-256-GCM, safeHandler, auto-redaction, SECURITY.md |
| **Documentation (MD files)** | ⭐⭐⭐⭐ | Comprehensive but has naming inconsistencies |
| **Website** | ⭐⭐⭐⭐ | Professional design, missing some commands |
| **Install Experience** | ⭐⭐ | Broken by wrong package name + missing Claude config |
| **AI Agent Readiness** | ⭐ | Zero tool descriptions = agents are blind |
| **npm Publish** | ⭐⭐⭐⭐ | All 14 packages published correctly |

### Bottom Line

> [!IMPORTANT]
> ContextHub is an **extremely well-architected project** with serious security engineering and a comprehensive feature set. However, it has **3 critical installation-blocking bugs** — the wrong package name in `.cursor/mcp.json`, missing tool descriptions for AI agents, and missing Claude Code auto-setup. A normal user will hit errors within 30 seconds of trying to use it. Once these are fixed, the install experience should be smooth.
