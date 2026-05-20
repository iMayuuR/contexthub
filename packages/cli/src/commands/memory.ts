import { ContextHubCore } from '@imayuur/contexthub-core';
import { join } from 'path';
import { existsSync } from 'fs';
import { log } from 'console';

export async function memoryCommand(options: any): Promise<void> {
  try {
    const currentDir = process.cwd();
    const contexthubDir = join(currentDir, '.contexthub');

    if (!existsSync(contexthubDir)) {
      console.error('ContextHub is not initialized in this repository. Run "contexthub init" first.');
      process.exit(1);
    }

    const core = new ContextHubCore(currentDir);

    if (options.list) {
      const memories = await core.searchMemories({ limit: 50 });
      console.log(`Found ${memories.length} memories:`);
      memories.forEach((mem, index) => {
        console.log(`${index + 1}. [${mem.type}] ${mem.content.substring(0, 100)}${mem.content.length > 100 ? '...' : ''}`);
        console.log(`   ID: ${mem.id} | Time: ${new Date(mem.timestamp).toLocaleString()} | Tags: ${mem.tags.join(', ')}`);
        console.log();
      });
    } else if (options.add) {
      // We need a session ID - get the most recent session or create a new one
      // For simplicity, we'll create a new CLI session
      const sessionId = await core.createSession('cli', { source: 'manual' });

      const memoryId = await core.saveMemory({
        sessionId,
        type: 'manual',
        content: options.add,
        timestamp: Date.now(),
        tags: ['manual']
      });

      console.log(`Memory saved with ID: ${memoryId}`);

      // End the session
      await core.endSession(sessionId);
    } else if (options.search) {
      // Simple text search for now - we'll implement semantic search later
      const memories = await core.searchMemories({
        tags: options.type ? [options.type] : undefined,
        limit: 20
      });

      const filteredMemories = memories.filter(mem =>
        mem.content.toLowerCase().includes(options.search.toLowerCase())
      );

      console.log(`Found ${filteredMemories.length} memories matching "${options.search}":`);
      filteredMemories.forEach((mem, index) => {
        console.log(`${index + 1}. [${mem.type}] ${mem.content.substring(0, 100)}${mem.content.length > 100 ? '...' : ''}`);
        console.log(`   ID: ${mem.id} | Time: ${new Date(mem.timestamp).toLocaleString()} | Tags: ${mem.tags.join(', ')}`);
        console.log();
      });
    } else {
      console.log('Please specify an action: --list, --add <content>, or --search <query>');
      console.log('Use --type <type> to filter by memory type');
    }

    await core.close();
  } catch (error) {
    console.error('Failed to manage memory:', error);
    process.exit(1);
  }
}