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
import { join } from 'path';
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { SecurityManager } from '@imayuur/contexthub-core';
import { resolveMcpServerEntry } from '../resolve-mcp-server';

export async function startServer(port: number): Promise<void> {
  try {
    const currentDir = process.cwd();
    const security = new SecurityManager(currentDir);

    security.validatePort(port);

    const mcpServerIndex = resolveMcpServerEntry();

    const authPath = join(currentDir, '.contexthub', '.auth-token');
    if (existsSync(authPath) && !process.env.CONTEXTHUB_TOKEN) {
      process.env.CONTEXTHUB_TOKEN = readFileSync(authPath, 'utf8').trim();
    }

    console.log('Starting ContextHub MCP server (stdio transport)...');
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