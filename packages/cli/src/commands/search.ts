import { ContextHubCore } from '@contexthub/core';
import { join } from 'path';
import { existsSync } from 'fs';
import { log } from 'console';

// For now, we'll implement a simple text-based search
// In a later phase, we'll integrate with the vector engine for semantic search

export async function searchCommand(query: string, limit: number): Promise<void> {
  try {
    const currentDir = process.cwd();
    const contexthubDir = join(currentDir, '.contexthub');

    if (!existsSync(contexthubDir)) {
      console.error('ContextHub is not initialized in this repository. Run "contexthub init" first.');
      process.exit(1);
    }

    const core = new ContextHubCore(currentDir);

    // For now, we'll do a simple text search across all memories
    // We'll get all memories and filter by content
    // In a real implementation, we would use the vector engine or full-text search
    const allMemories = await core.searchMemories({ limit: 1000 }); // Get a large set to filter

    const filteredMemories = allMemories.filter(mem =>
      mem.content.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit); // Apply limit after filtering

    console.log(`Found ${filteredMemories.length} memories matching "${query}" (showing top ${limit}):`);
    console.log('='.repeat(60));

    if (filteredMemories.length === 0) {
      console.log('No memories found matching the query.');
      await core.close();
      return;
    }

    filteredMemories.forEach((mem, index) => {
      console.log(`${index + 1}. [${mem.type}] ${mem.content.substring(0, 150)}${mem.content.length > 150 ? '...' : ''}`);
      console.log(`   ID: ${mem.id}`);
      console.log(`   Session: ${mem.sessionId}`);
      console.log(`   Time: ${new Date(mem.timestamp).toLocaleString()}`);
      console.log(`   Tags: ${mem.tags.join(', ')}`);
      if (mem.embedding) {
        console.log(`   Has embedding: Yes (${mem.embedding.length} dimensions)`);
      }
      console.log();
    });

    await core.close();
  } catch (error) {
    console.error('Failed to search memories:', error);
    process.exit(1);
  }
}