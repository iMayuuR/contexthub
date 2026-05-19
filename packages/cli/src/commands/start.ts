/**
 * Start Command — Hardened
 *
 * Security changes:
 * - Safe path resolution (no blind relative traversal)
 * - Port validation (1024-65535)
 * - PID file for process management
 * - Graceful shutdown on SIGINT/SIGTERM
 * - Sanitized error output
 */

import { spawn } from 'child_process';
import { join, resolve } from 'path';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { SecurityManager } from '@contexthub/core';

export async function startServer(port: number): Promise<void> {
  try {
    const currentDir = process.cwd();
    const security = new SecurityManager(currentDir);

    // Validate port
    const safePort = security.validatePort(port);

    // Resolve MCP server path safely — within the current project
    const mcpServerIndex = join(currentDir, 'packages', 'mcp-server', 'dist', 'index.js');

    // Validate the path stays within repo
    security.validatePath(mcpServerIndex);

    console.log(`Starting ContextHub MCP server on port ${safePort}...`);

    if (!existsSync(mcpServerIndex)) {
      console.log('⚠️  Built server not found.');
      console.log('Please build the MCP server first:');
      console.log('  npm run build');
      console.log('Then start the server:');
      console.log('  contexthub start');
      return;
    }

    console.log('Starting MCP server...');
    const serverProcess = spawn('node', [mcpServerIndex], {
      cwd: currentDir,
      stdio: 'inherit'
    });

    // Write PID file
    const pidPath = join(currentDir, '.contexthub', 'server.pid');
    if (existsSync(join(currentDir, '.contexthub'))) {
      writeFileSync(pidPath, String(serverProcess.pid), { mode: 0o600 });
    }

    // Graceful shutdown handlers
    const cleanup = () => {
      console.log('\nShutting down MCP server...');
      serverProcess.kill('SIGTERM');
      try {
        if (existsSync(pidPath)) unlinkSync(pidPath);
      } catch { /* ignore */ }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    serverProcess.on('error', (err) => {
      console.error('Failed to start MCP server:', err.message);
      try { if (existsSync(pidPath)) unlinkSync(pidPath); } catch { /* ignore */ }
      process.exit(1);
    });

    serverProcess.on('close', (code) => {
      try { if (existsSync(pidPath)) unlinkSync(pidPath); } catch { /* ignore */ }
      if (code !== 0) {
        console.error(`MCP server exited with code ${code}`);
        process.exit(code === null ? 1 : code);
      }
    });
  } catch (error: any) {
    const safeMsg = String(error?.message || 'Unknown error').replace(/\/[^\s]+/g, '[path]');
    console.error('Failed to start MCP server:', safeMsg);
    process.exit(1);
  }
}