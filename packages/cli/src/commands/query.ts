import { ContextHubCore, runUnifiedQuery } from '@imayuur/contexthub-core';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { CodeGraphManager } from '@imayuur/contexthub-knowledge-graph';
import { GitIntegration } from '@imayuur/contexthub-git-integration';

export interface QueryOptions {
  limit?: string;
  json?: boolean;
}

export async function queryCommand(queryText: string, options: QueryOptions = {}): Promise<void> {
  const currentDir = process.cwd();
  
  try {
    const limit = Number(options.limit || '10');
    const wantsJson = !!options.json;

    const core = new ContextHubCore(currentDir);
    await core.initStorage();

    const vectorEngine = new VectorEngine(currentDir);
    const graphManager = new CodeGraphManager(currentDir);
    const gitIntegration = new GitIntegration(core, currentDir);

    const result = await runUnifiedQuery(
      queryText,
      limit,
      core,
      vectorEngine,
      graphManager,
      gitIntegration
    );

    if (wantsJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Gorgeous Terminal UI (Rich Aesthetics)
    console.log('\n\x1b[36m================================================================================\x1b[0m');
    console.log(`\x1b[1m\x1b[35mContextHub Unified Query:\x1b[0m "${queryText}"`);
    console.log('\x1b[36m================================================================================\x1b[0m\n');

    console.log(result.answerSummary);

    if (result.memories.length > 0) {
      console.log('\x1b[1m\x1b[32mRelevant Memory Entries:\x1b[0m');
      result.memories.forEach((mem, idx) => {
        console.log(`  \x1b[34m[${idx + 1}] (${mem.type})\x1b[0m ${mem.content.substring(0, 200)}${mem.content.length > 200 ? '...' : ''}`);
        if (mem.tags.length > 0) {
          console.log(`      Tags: ${mem.tags.map(t => `\`${t}\``).join(', ')}`);
        }
      });
      console.log();
    }

    if (result.codeHits.length > 0) {
      console.log('\x1b[1m\x1b[33mKnowledge Graph Code Hits:\x1b[0m');
      result.codeHits.forEach((hit, idx) => {
        const symbolStr = hit.symbol ? `#${hit.symbol}` : '';
        console.log(`  \x1b[33m[${idx + 1}]\x1b[0m \x1b[1m${hit.path}${symbolStr}\x1b[0m`);
        console.log(`      Reason: ${hit.reason}`);
      });
      console.log();
    }

    if (result.gitHits && result.gitHits.length > 0) {
      console.log('\x1b[1m\x1b[31mRecent Git History:\x1b[0m');
      result.gitHits.forEach((git, idx) => {
        console.log(`  \x1b[31m[${idx + 1}] (${git.hash})\x1b[0m ${git.message} (${git.author})`);
      });
      console.log();
    }

    if (result.trace) {
      console.log('\x1b[1m\x1b[36mDependency Hops Trace:\x1b[0m');
      console.log(`  ${result.trace.hops.map(h => `\x1b[4m${h.label}\x1b[0m (${h.type})`).join(' \x1b[36m→\x1b[0m ')}`);
      console.log();
    }

  } catch (error: any) {
    const safeMsg = String(error?.message || 'Unknown error').replace(/\/[^\s]+/g, '[path]');
    console.error('\x1b[31mFailed to run unified query:\x1b[0m', safeMsg);
    process.exit(1);
  }
}
