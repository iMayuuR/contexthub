import { ContextHubCore } from "@contexthub/core";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { spawn } from "child_process";

export async function setupCommand(options: any = {}): Promise<void> {
  try {
    const currentDir = process.cwd();
    const contexthubDir = join(currentDir, ".contexthub");

    console.log("🚀 Setting up ContextHub for automatic operation...");

    // Step 1: Initialize ContextHub if not already done
    if (!existsSync(contexthubDir)) {
      console.log("📁 Initializing ContextHub...");
      const core = new ContextHubCore(currentDir);
      await core.initStorage();
      console.log("✅ ContextHub initialized");
    } else {
      console.log("ℹ️  ContextHub already initialized");
    }

    // Step 2: Start MCP server in background for the current session
    console.log("🔌 Starting MCP server in background...");
    const serverProcess = spawn("node", [join(currentDir, "packages", "cli", "dist", "index.js"), "start", "--port", "3000"], {
      detached: true,
      stdio: "ignore"
    });

    serverProcess.unref();
    console.log("✅ MCP server started on http://localhost:3000 (running in background)");

    // Step 3: Set up automatic memory saving via shell profile (simple approach)
    const homeDir = homedir();
    // Try to detect common shell profiles
    const profilePaths = [
      join(homeDir, ".bashrc"),
      join(homeDir, ".zshrc"),
      join(homeDir, ".profile")
    ];

    let profileFound = false;
    for (const profilePath of profilePaths) {
      if (existsSync(profilePath)) {
        profileFound = true;
        // Check if our setup already exists
        let profileContent = "";
        try {
          profileContent = readFileSync(profilePath, "utf8");
        } catch (e) {
          profileContent = "";
        }

        const setupMarker = "# ContextHub automatic setup";
        if (!profileContent.includes(setupMarker)) {
          // Prepare a simple setup script
          const setupScript = `
# ContextHub automatic setup
# Start MCP server if not running (check every time)
if ! pgrep -f "node.*packages.*cli.*dist.*index.js.*start.*--port.*3000" > /dev/null 2>&1; then
  echo "Starting ContextHub MCP server..."
  node "$(dirname "$0")/../packages/cli/dist/index.js" start --port 3000 >/dev/null 2>&1 &
fi

# Function to save the last command to ContextHub memory
save_last_command_to_contexthub() {
  # Get the last command from history (bash/zsh specific)
  if [ -n "\$BASH_COMMAND" ] && [ "\$BASH_COMMAND" != "\$PROMPT_COMMAND" ] && [[ ! "\$BASH_COMMAND" =~ ^contexthub ]]; then
    # Save as a manual memory with source automatic
    contexthub memory --add "\$BASH_COMMAND" --type manual --source automatic 2>/dev/null
  fi
}

# Set the trap to run before each prompt
trap save_last_command_to_contexthub DEBUG
# End ContextHub automatic setup
`;

          // Append to profile
          appendFileSync(profilePath, `\n${setupMarker}\n${setupScript}\n`);
          console.log(`✅ Added auto-save hook to ${profilePath}`);
        } else {
          console.log(`ℹ️  ContextHub setup already exists in ${profilePath}`);
        }
        break;
      }
    }

    if (!profileFound) {
      console.log("⚠️  No standard shell profile (.bashrc, .zshrc, .profile) found.");
      console.log("   Please manually add the MCP server start command to your shell profile.");
      console.log("   You can start the MCP server with: contexthub start");
    }

    console.log("\n🎉 ContextHub automatic setup complete!");
    console.log("\n📋 What was configured:");
    console.log("  • ContextHub initialized (if needed)");
    console.log("  • MCP server started on http://localhost:3000 (background)");
    if (profileFound) {
      console.log("  • Automatic memory saving enabled via shell profile");
      console.log("  • The MCP server will check and start if needed in each new prompt");
    }
    console.log("\n💡 Next steps:");
    console.log("  1. Restart your terminal or reload your profile:");
    console.log("     Bash: source ~/.bashrc");
    console.log("     Zsh: source ~/.zshrc");
    console.log("  2. Your commands will now be automatically saved as memories");
    console.log("  3. AI agents can connect to http://localhost:3000 for context");
    console.log("  4. Run 'contexthub memory --list' to see saved memories");
    console.log("  5. Run 'contexthub timeline' to see session history");
    console.log("\n⚠️  Notes:");
    console.log("  • The MCP server will continue running in the background");
    console.log("  • To stop it, find the node process and kill it (or restart your terminal)");
    console.log("  • Automatic saving skips ContextHub commands to avoid loops");
  } catch (error) {
    console.error("❌ Failed to setup ContextHub:", error);
    process.exit(1);
  }
}