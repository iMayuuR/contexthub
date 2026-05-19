#!/usr/bin/env node

import { Command } from 'commander';
import { initContextHub } from './commands/init';
import { startServer } from './commands/start';
import { memoryCommand } from './commands/memory';
import { timelineCommand } from './commands/timeline';
import { searchCommand } from './commands/search';
import { setupCommand } from './commands/setup';
import { ContextHubCore } from '@contexthub/core';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const program = new Command();

program
  .name('contexthub')
  .description('ContextHub - persistent AI memory + context orchestration layer')
  .version('0.1.0');

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

program.parse();