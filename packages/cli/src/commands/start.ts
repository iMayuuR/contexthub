import { spawn } from 'child_process';
import { join } from 'path';
import { log } from 'console';

export async function startServer(port: number): Promise<void> {
  try {
    const currentDir = process.cwd();
    const mcpServerDir = join(currentDir, '..', '..', 'packages', 'mcp-server');

    console.log(`Starting ContextHub MCP server on port ${port}...`);
    console.log(`Server directory: ${mcpServerDir}`);

    // In a real implementation, we would start the MCP server here.
    // For now, we'll simulate by running a command that shows we are starting.
    // We'll use the built version if available, otherwise we'll run in development mode.

    // Check if the MCP server is built
    const distDir = join(mcpServerDir, 'dist');
    const indexJs = join(distDir, 'index.js');

    // We don't have a way to check file existence in this environment without fs, but we'll assume we can use fs.
    // We'll import fs synchronously for simplicity in this CLI command.
    const { existsSync } = await import('fs');
    const { execSync } = await import('child_process');

    if (existsSync(indexJs)) {
      console.log('Starting built MCP server...');
      // We would normally start the server with node, but we are in a CLI command and we want to keep the process running.
      // We'll spawn a child process to run the server and keep the CLI process alive until the server exits.
      const serverProcess = spawn('node', [indexJs, '--port', port.toString()], {
        cwd: mcpServerDir,
        stdio: 'inherit'
      });

      serverProcess.on('error', (err) => {
        console.error('Failed to start MCP server:', err);
        process.exit(1);
      });

      serverProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`MCP server exited with code ${code}`);
          process.exit(code === null ? 1 : code);
        }
      });
    } else {
      console.log('Built server not found. Starting in development mode...');
      // We'll try to run the MCP server in development mode using ts-node if available, or we'll build and run.
      // For simplicity, we'll just print instructions.
      console.log('Please build the MCP server first:');
      console.log('  cd packages/mcp-server && npm run build');
      console.log('Then start the server:');
      console.log('  contexthub start');
      console.log('Or, if you have ts-node installed, you can run:');
      console.log('  cd packages/mcp-server && npx ts-node src/index.ts --port', port);
    }
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}