/**
 * Stop Command — NEW
 *
 * Cleanly stops the ContextHub MCP server:
 * - Reads PID from .contexthub/server.pid
 * - Sends SIGTERM to the process
 * - Verifies the process has exited
 * - Removes the PID file
 */

import { join } from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';

export async function stopCommand(): Promise<void> {
  try {
    const currentDir = process.cwd();
    const pidPath = join(currentDir, '.contexthub', 'server.pid');

    if (!existsSync(pidPath)) {
      console.log('ℹ️  No running ContextHub server found (no PID file).');
      return;
    }

    const pidStr = readFileSync(pidPath, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);

    if (isNaN(pid) || pid <= 0) {
      console.error('⚠️  Invalid PID in server.pid file. Removing stale PID file.');
      unlinkSync(pidPath);
      return;
    }

    // Check if process is actually running
    try {
      process.kill(pid, 0); // Signal 0 = check existence, don't actually kill
    } catch {
      console.log(`ℹ️  Process ${pid} is not running. Removing stale PID file.`);
      unlinkSync(pidPath);
      return;
    }

    // Send SIGTERM for graceful shutdown
    console.log(`🛑 Stopping ContextHub MCP server (PID: ${pid})...`);
    process.kill(pid, 'SIGTERM');

    // Wait briefly and verify
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      process.kill(pid, 0);
      // Still running — try SIGKILL
      console.log('⚠️  Process still running. Sending SIGKILL...');
      process.kill(pid, 'SIGKILL');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {
      // Process has exited — good
    }

    // Clean up PID file
    try {
      if (existsSync(pidPath)) unlinkSync(pidPath);
    } catch { /* ignore */ }

    console.log('✅ ContextHub MCP server stopped.');
  } catch (error: any) {
    const safeMsg = String(error?.message || 'Unknown error').replace(/\/[^\s]+/g, '[path]');
    console.error('❌ Failed to stop server:', safeMsg);
    process.exit(1);
  }
}
