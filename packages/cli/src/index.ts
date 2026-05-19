#!/usr/bin/env node

import { Command } from 'commander';
import { initContextHub } from './commands/init';
import { startServer } from './commands/start';
import { memoryCommand } from './commands/memory';
import { timelineCommand } from './commands/timeline';
import { searchCommand } from './commands/search';
import { setupCommand } from './commands/setup';
import { stopCommand } from './commands/stop';
import { watchCommand } from './commands/watch';
import { queryCommand } from './commands/query';
import { exportGraphCommand } from './commands/export-graph';
import { dashboardCommand } from './commands/dashboard';
import { ingestDocsCommand } from './commands/ingest-docs';
import { reportCommand } from './commands/report';
import { readFileSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
) as { version: string };

const program = new Command();

program
  .name('contexthub')
  .description('ContextHub MCP server launcher — encrypted memory for AI coding agents')
  .version(pkg.version);

// Initialize ContextHub in a repository
program
  .command('init')
  .description('Initialize ContextHub in the current repository')
  .action(async () => {
    await initContextHub();
  });

// Start the ContextHub MCP server
program
  .command('start')
  .description('Start the ContextHub MCP server')
  .option('--port <port>', 'Port to run the server on', '3000')
  .action(async (options) => {
    await startServer(Number(options.port));
  });

// Memory management
program
  .command('memory')
  .description('Manage ContextHub memories')
  .option('--list', 'List all memories')
  .option('--add <content>', 'Add a new memory')
  .option('--search <query>', 'Search memories')
  .option('--type <type>', 'Filter by memory type')
  .action(async (options) => {
    await memoryCommand(options);
  });

// View session timeline
program
  .command('timeline')
  .description('View session timeline')
  .option('--limit <number>', 'Limit number of sessions to show', '10')
  .action(async (options) => {
    await timelineCommand(Number(options.limit));
  });

// Search memories
program
  .command('search')
  .description('Search memories with semantic search')
  .option('--query <query>', 'Search query') // required option
  .option('--limit <number>', 'Limit number of results', '10')
  .action(async (options) => {
    await searchCommand(options.query, Number(options.limit));
  });

// Setup ContextHub for automatic operation
program
  .command('setup')
  .description('Setup ContextHub for automatic operation with MCP server and memory saving')
  .action(async () => {
    await setupCommand();
  });

// Stop ContextHub server
program
  .command('stop')
  .description('Stop the running ContextHub MCP server')
  .action(async () => {
    await stopCommand();
  });

// Watch files recursively
program
  .command('watch [path]')
  .description('Start recursive, incremental file watcher')
  .option('--debounce <ms>', 'Debounce duration in ms', '3000')
  .option('--no-embeddings', 'Disable vector embeddings updates')
  .option('--quiet', 'Disable console output logs')
  .action(async (watchPath, options) => {
    await watchCommand(watchPath || '.', options);
  });

// Export code graph to HTML
program
  .command('export-graph')
  .description('Export code graph to standalone HTML')
  .option('--output <path>', 'Output file path (default: graph.html)')
  .action(async (options) => {
    await exportGraphCommand(options);
  });

// Local Dashboard
program
  .command('dashboard')
  .description('Start local ContextHub dashboard server')
  .option('--port <number>', 'Port to listen on', '3847')
  .action(async (options) => {
    await dashboardCommand(options);
  });

// Unified Query command
program
  .command('query <queryText>')
  .description('Unified semantic search + memories + code graph traversal + git history')
  .option('--limit <number>', 'Limit search results count', '10')
  .option('--json', 'Output results as raw JSON')
  .action(async (queryText, options) => {
    await queryCommand(queryText, options);
  });

// Global error handler — sanitize output
process.on('uncaughtException', (err) => {
  const safeMsg = String(err?.message || 'Unknown error').replace(/\/[^\s]+/g, '[path]');
  console.error('Unexpected error:', safeMsg);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const safeMsg = String(reason || 'Unknown error').replace(/\/[^\s]+/g, '[path]');
  console.error('Unhandled rejection:', safeMsg);
  process.exit(1);
});

// Ingest Docs
program
  .command('ingest-docs [patterns...]')
  .description('Ingest markdown documentation into ContextHub vector engine')
  .action(async (patterns: string[]) => {
    await ingestDocsCommand({ patterns });
  });

// Generate GRAPH_REPORT.md
program
  .command('report')
  .description('Generate GRAPH_REPORT.md from the code graph')
  .option('--stdout', 'Print report to stdout instead of writing to file')
  .action(async (options) => {
    await reportCommand(options);
  });

program.parse();