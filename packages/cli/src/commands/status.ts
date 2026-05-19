import { ContextHubCore } from '@contexthub/core';
import { CodeGraphManager } from '@contexthub/knowledge-graph';
import { GitIntegration } from '@contexthub/git-integration';
import chalk from 'chalk';

export async function statusCommand(): Promise<void> {
  const currentDir = process.cwd();
  
  try {
    const core = new ContextHubCore(currentDir);
    await core.initStorage();
    const graphManager = new CodeGraphManager(currentDir);
    const gitIntegration = new GitIntegration(core, currentDir);
    
    console.log(chalk.bold.blue('\nContextHub Status\n'));
    
    // 1. Memories
    const memories = await core.searchMemories({ limit: 10000 });
    console.log(`${chalk.cyan('Memories:')} ${memories.length}`);
    
    // 2. Code Graph
    try {
      const graph = await graphManager.loadGraph();
      console.log(`${chalk.cyan('Code Graph Nodes:')} ${graph.nodes.length}`);
      console.log(`${chalk.cyan('Code Graph Edges:')} ${graph.edges.length}`);
    } catch {
      console.log(`${chalk.cyan('Code Graph:')} Not initialized or empty`);
    }
    
    // 3. Git Summary
    try {
      const git = await gitIntegration.getGitSummary();
      console.log(`${chalk.cyan('Current Branch:')} ${git.currentBranch}`);
      console.log(`${chalk.cyan('Recent Commits:')} ${git.recentCommits.length}`);
    } catch {
      console.log(`${chalk.cyan('Git:')} Not available`);
    }
    
    console.log();
  } catch (error: any) {
    console.error(chalk.red(`Failed to get status: ${error.message}`));
    process.exit(1);
  }
}
