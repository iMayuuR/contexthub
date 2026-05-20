import { ContextHubCore } from '@imayuur/contexthub-core';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { GitIntegration } from '@imayuur/contexthub-git-integration';
import { buildContextBundle } from '@imayuur/contexthub-mcp-server';

export interface ContextOptions {
  query?: string;
  path?: string;
}

export async function contextCommand(options: ContextOptions = {}): Promise<void> {
  const currentDir = process.cwd();

  try {
    const core = new ContextHubCore(currentDir);
    await core.initStorage();

    const vectorEngine = new VectorEngine(currentDir);
    const graphManager = new CodeGraphManager(currentDir);
    const gitIntegration = new GitIntegration(core, currentDir);

    const bundle = await buildContextBundle(
      { query: options.query, path: options.path, repoPath: currentDir },
      core,
      vectorEngine,
      graphManager,
      gitIntegration
    );

    console.log(JSON.stringify(bundle, null, 2));

  } catch (error: any) {
    const safeMsg = String(error?.message || 'Unknown error').replace(/\/[^\s]+/g, '[path]');
    console.error('\x1b[31mFailed to build context bundle:\x1b[0m', safeMsg);
    process.exit(1);
  }
}
