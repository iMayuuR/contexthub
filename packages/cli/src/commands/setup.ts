/**
 * Setup Command — Hardened
 *
 * Security changes vs original:
 * - REMOVED: Shell profile modification (~/.bashrc, ~/.zshrc injection)
 * - REMOVED: DEBUG trap that captured every shell command
 * - ADDED: PID file management for clean process lifecycle
 * - ADDED: Secure .contexthub/ directory permissions
 * - ADDED: Auth token generation for MCP server
 */

import { ContextHubCore, SecurityManager } from "@contexthub/core";
import { join } from "path";
import { existsSync, writeFileSync } from "fs";
import { spawn } from "child_process";
import { resolveMcpServerEntry } from "../resolve-mcp-server";
import { installAgentIntegrations } from "../agent-integrations/install";
import { installContexthubSkill } from "../agent-integrations/install";
import chalk from "chalk";

export async function setupCommand(options: any = {}): Promise<void> {
  try {
    const currentDir = process.cwd();
    const contexthubDir = join(currentDir, ".contexthub");
    const security = new SecurityManager(currentDir);

    console.log("🚀 Setting up ContextHub (secure mode)...");

    // Step 1: Initialize ContextHub if not already done
    if (!existsSync(contexthubDir)) {
      console.log("📁 Initializing ContextHub...");
      const core = new ContextHubCore(currentDir);
      await core.initStorage();
      security.setSecurePermissions(contexthubDir, true);
      console.log("✅ ContextHub initialized with encrypted storage");
    } else {
      console.log("ℹ️  ContextHub already initialized");
    }

    // Step 2: Generate auth token (value is saved to disk, not logged)
    console.log("🔑 Generating auth token...");
    security.generateAuthToken(); // Token saved to .contexthub/.auth-token — never printed
    console.log("✅ Auth token generated and saved to .contexthub/.auth-token");

    // Step 2b: Agent integrations (rules, MCP config, Cursor hooks)
    console.log("🤖 Installing secure auto-memory for all agents...");
    const installed = installAgentIntegrations(currentDir, security);
    console.log("✅ Agent integrations:");
    if (installed.cursorRule) console.log("   • .cursor/rules/contexthub-auto-memory.mdc");
    if (installed.cursorMcp) console.log("   • .cursor/mcp.json (contexthub server entry)");
    if (installed.cursorHooks) console.log("   • .cursor/hooks (stop/sessionEnd → encrypted save)");
    if (installed.agentsMd) console.log("   • AGENTS.md section");
    if (installed.claudeMd) console.log("   • CLAUDE.md section");
    console.log("   • .contexthub/agent-policy.md");

    // Step 2c: Install Claude Code Skill
    console.log(chalk.blue("🧩 Installing ContextHub skill..."));
    const skillPath = installContexthubSkill(currentDir);
    if (skillPath) {
      console.log(chalk.green(`   • Skill installed to ${skillPath}`));
    }

    // Step 3: Start MCP server in background with PID tracking
    console.log("🔌 Starting MCP server in background...");

    let mcpServerDist: string | undefined;
    try {
      mcpServerDist = resolveMcpServerEntry();
    } catch (err: any) {
      const safeMsg = String(err?.message || "MCP server not found").replace(/\/[^\s]+/g, "[path]");
      console.log(`⚠️  ${safeMsg}`);
      console.log("   Reinstall: npm install -g @contexthub/cli");
    }

    if (mcpServerDist) {
      const serverProcess = spawn("node", [mcpServerDist], {
        cwd: currentDir,
        detached: true,
        stdio: "ignore",
      });

      // Write PID file for clean lifecycle management
      const pidPath = join(contexthubDir, "server.pid");
      writeFileSync(pidPath, String(serverProcess.pid), { mode: 0o600 });
      security.setSecurePermissions(pidPath);

      serverProcess.unref();
      console.log(`✅ MCP server started (PID: ${serverProcess.pid})`);
      console.log(`   PID file: .contexthub/server.pid`);
    }

    console.log("\n🎉 ContextHub secure setup complete!");
    console.log("\n📋 What was configured:");
    console.log("  • ContextHub initialized with AES-256-GCM encrypted storage");
    console.log("  • Encryption key generated at .contexthub/.keyfile (mode 0600)");
    console.log("  • Auth token generated at .contexthub/.auth-token");
    console.log("  • .contexthub/ directory secured (mode 0700)");
    console.log("  • MCP server started in background with PID file");

    console.log("\n🔒 Security notes:");
    console.log("  • All memories are encrypted at rest (AES-256-GCM)");
    console.log("  • Sensitive data (API keys, passwords) is auto-redacted");
    console.log("  • Input validation enabled on all MCP tool parameters");
    console.log("  • Shell profile is NOT modified (no command capture)");

    console.log("\n💡 Auto-memory is ON (secure):");
    console.log("  • MCP tools: ensure_session → record_turn each meaningful turn");
    console.log("  • Cursor: rules + hooks installed (commit .cursor/ to share with team)");
    console.log("  • Claude Code / others: see AGENTS.md and CLAUDE.md sections");
    console.log("\n💡 Next steps:");
    console.log("  1. Reload Cursor / restart Claude Code to pick up MCP + rules");
    console.log("  2. contexthub memory --list  — verify saves");
    console.log("  3. contexthub stop  — stop background server when done");
  } catch (error: any) {
    const safeMsg = String(error?.message || "Unknown error").replace(/\/[^\s]+/g, "[path]");
    console.error("❌ Failed to setup ContextHub:", safeMsg);
    process.exit(1);
  }
}