import { ContextHubCore } from '@contexthub/core';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { log } from 'console';

export async function initContextHub(): Promise<void> {
  try {
    const currentDir = process.cwd();
    const contexthubDir = join(currentDir, '.contexthub');

    // Check if already initialized
    if (existsSync(contexthubDir)) {
      console.log('ContextHub is already initialized in this repository.');
      return;
    }

    // Create .contexthub directory
    mkdirSync(contexthubDir, { recursive: true });

    // Create subdirectories
    mkdirSync(join(contexthubDir, 'sessions'), { recursive: true });
    mkdirSync(join(contexthubDir, 'embeddings'), { recursive: true });
    mkdirSync(join(contexthubDir, 'summaries'), { recursive: true });
    mkdirSync(join(contexthubDir, 'graph'), { recursive: true });
    mkdirSync(join(contexthubDir, 'skills'), { recursive: true });
    mkdirSync(join(contexthubDir, 'rules'), { recursive: true });
    mkdirSync(join(contexthubDir, 'cache'), { recursive: true });

    // Initialize package.json if not present (for local installation)
    const packageJsonPath = join(currentDir, 'package.json');
    let packageJson = {};
    if (existsSync(packageJsonPath)) {
      const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
      packageJson = JSON.parse(packageJsonContent);
    }

    // Add devDependency on contexthub if not present (for local development)
    // In production, users would install contexthub as a devDependency
    // We are doing this for the sake of the example, but note that this is a CLI tool.
    // We'll skip modifying the user's package.json for now to avoid unintended changes.
    // Instead, we'll just note that they should add contexthub as a devDependency.

    // Create a basic contexthub.config.js
    const configPath = join(currentDir, 'contexthub.config.js');
    const configContent = `
module.exports = {
  // ContextHub configuration
  // See https://github.com/contexthub/contexthub for options:
};
`.trim();

    writeFileSync(configPath, configContent, 'utf8');

    // Initialize the core storage (which will create the SQLite database)
    const core = new ContextHubCore(currentDir);
    await core.initStorage(); // We'll need to add this method to ContextHubCore

    console.log('ContextHub initialized successfully!');
    console.log(`Configuration file created at ${configPath}`);
    console.log(`Memory storage initialized at ${contexthubDir}`);
    console.log('\nNext steps:');
    console.log('  1. Add "@contexthub/core" as a devDependency to your package.json (if developing locally)');
    console.log('  2. Run "contexthub start" to start the MCP server');
    console.log('  3. Use "contexthub memory" to manage memories');
  } catch (error) {
    console.error('Failed to initialize ContextHub:', error);
    process.exit(1);
  }
}