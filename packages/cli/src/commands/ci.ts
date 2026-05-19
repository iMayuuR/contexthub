import * as fs from 'fs';
import * as path from 'path';
import { SecurityManager, ContextHubCore } from '@contexthub/core';
import { CodeGraphManager, writeGraphReport } from '@contexthub/knowledge-graph';
import chalk from 'chalk';

export async function ciCommand(): Promise<void> {
  console.log(chalk.bold.blue('\nContextHub CI — Non-Interactive Execution\n'));
  
  const currentDir = process.cwd();
  const contexthubDir = path.join(currentDir, '.contexthub');
  const keyfile = path.join(contexthubDir, '.keyfile');
  
  let hasErrors = false;

  const logCheck = (desc: string, pass: boolean, errorMsg?: string) => {
    if (pass) {
      console.log(`${chalk.green('✓')} ${desc}`);
    } else {
      console.log(`${chalk.red('✗')} ${desc}`);
      if (errorMsg) console.log(`  ${chalk.red(errorMsg)}`);
      hasErrors = true;
    }
  };

  try {
    // 1. Verify Setup
    logCheck('ContextHub directory exists', fs.existsSync(contexthubDir));
    
    if (fs.existsSync(contexthubDir)) {
      logCheck('Keyfile exists', fs.existsSync(keyfile));
      
      // Decryption Check
      try {
        const core = new ContextHubCore(currentDir);
        await core.initStorage();
        await core.searchMemories({ limit: 1 });
        logCheck('Memories decrypt successfully', true);
      } catch (e: any) {
        logCheck('Memories decrypt successfully', false, e.message);
      }
    }
    
    if (hasErrors) {
      console.error(chalk.red.bold('\nCI Verification Failed: Setup is incomplete or insecure.'));
      process.exit(1);
    }

    // 2. Update Code Knowledge Graph
    console.log(chalk.blue('\nUpdating Code Knowledge Graph...'));
    const graphManager = new CodeGraphManager(currentDir);
    const graph = await graphManager.buildCodeGraph();
    console.log(chalk.green(`✓ Knowledge Graph updated successfully (${graph.nodes.length} nodes, ${graph.edges.length} edges).`));

    // 3. Generate GRAPH_REPORT.md
    console.log(chalk.blue('Generating Graph Report...'));
    const core = new ContextHubCore(currentDir);
    await core.initStorage();
    const memories = await core.searchMemories({});
    
    let gitBranch: string | undefined;
    try {
      const { GitIntegration } = await import('@contexthub/git-integration');
      const git = new GitIntegration(core, currentDir);
      const summary = await git.getGitSummary();
      gitBranch = summary.currentBranch;
    } catch {}

    const reportPath = await writeGraphReport({
      repoPath: currentDir,
      memoryCount: memories.length,
      gitBranch
    });
    console.log(chalk.green(`✓ Graph report written to ${reportPath}`));

    // 4. Handle GITHUB_STEP_SUMMARY
    if (process.env.GITHUB_STEP_SUMMARY) {
      const summaryPath = process.env.GITHUB_STEP_SUMMARY;
      const reportContent = fs.readFileSync(reportPath, 'utf8');
      fs.appendFileSync(summaryPath, `\n${reportContent}\n`);
      console.log(chalk.green(`✓ Appended graph report to $GITHUB_STEP_SUMMARY`));
    }

  } catch (err: any) {
    console.error(chalk.red(`\nCI Unexpected Error: ${err.message}`));
    process.exit(1);
  }
  
  console.log(chalk.green.bold('\nContextHub CI completed successfully!'));
}
