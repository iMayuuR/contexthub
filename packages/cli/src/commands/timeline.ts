import { ContextHubCore } from '@contexthub/core';
import { join } from 'path';
import { existsSync } from 'fs';
import { log } from 'console';

export async function timelineCommand(limit: number): Promise<void> {
  try {
    const currentDir = process.cwd();
    const contexthubDir = join(currentDir, '.contexthub');

    if (!existsSync(contexthubDir)) {
      console.error('ContextHub is not initialized in this repository. Run "contexthub init" first.');
      process.exit(1);
    }

    const core = new ContextHubCore(currentDir);

    const sessions = await core.getSessions(limit);

    console.log(`Session Timeline (showing ${sessions.length} sessions):`);
    console.log('='.repeat(50));

    if (sessions.length === 0) {
      console.log('No sessions found.');
      return;
    }

    sessions.forEach((session, index) => {
      const startTime = new Date(session.startTime).toLocaleString();
      const endTime = session.endTime
        ? new Date(session.endTime).toLocaleString()
        : 'Active';

      console.log(`${index + 1}. Session ID: ${session.id}`);
      console.log(`   Agent: ${session.agent}`);
      console.log(`   Started: ${startTime}`);
      console.log(`   Ended: ${endTime}`);
      console.log(`   Repo: ${session.repoPath}`);

      if (Object.keys(session.metadata).length > 0) {
        console.log(`   Metadata: ${JSON.stringify(session.metadata)}`);
      }

      console.log();
    });

    await core.close();
  } catch (error) {
    console.error('Failed to get timeline:', error);
    process.exit(1);
  }
}