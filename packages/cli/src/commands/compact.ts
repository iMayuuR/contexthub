import { ContextHubCore } from '@contexthub/core';
import { join } from 'path';
import { existsSync } from 'fs';

export async function compactCommand(options: any): Promise<void> {
  try {
    const currentDir = process.cwd();
    const contexthubDir = join(currentDir, '.contexthub');

    if (!existsSync(contexthubDir)) {
      console.error('ContextHub is not initialized in this repository. Run "contexthub init" first.');
      process.exit(1);
    }

    const core = new ContextHubCore(currentDir);

    console.log('Compacting prompt/response memory sequences...');
    const compacted = await core.compactMemories();
    console.log(`Successfully merged ${compacted} prompt/response pairs into summaries.`);

    if (options.archiveAge !== undefined) {
      const maxAgeDays = Number(options.archiveAge);
      if (isNaN(maxAgeDays) || maxAgeDays < 0) {
        console.error('Invalid archive age. Must be a positive number of days.');
        await core.close();
        process.exit(1);
      }
      console.log(`Archiving memories older than ${maxAgeDays} days...`);
      const archived = await core.archiveOldMemories(maxAgeDays);
      console.log(`Successfully archived ${archived} memories.`);
    }

    await core.close();
  } catch (error) {
    console.error('Failed to compact memories:', error);
    process.exit(1);
  }
}
