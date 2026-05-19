import chalk from 'chalk';
import { generateGraphReport, writeGraphReport } from '@contexthub/knowledge-graph';
import { ContextHubCore } from '@contexthub/core';

export interface ReportOptions {
  stdout?: boolean;
}

export async function reportCommand(options: ReportOptions = {}): Promise<void> {
  const currentDir = process.cwd();

  console.log(chalk.blue('Generating graph report...'));

  // Gather optional context
  let memoryCount: number | undefined;
  let gitBranch: string | undefined;

  try {
    const core = new ContextHubCore(currentDir);
    const memories = await core.searchMemories({ limit: 1 });
    memoryCount = memories.length;
  } catch {}

  try {
    const { GitIntegration } = await import('@contexthub/git-integration');
    const core = new ContextHubCore(currentDir);
    const git = new GitIntegration(core, currentDir);
    const summary = await git.getGitSummary();
    gitBranch = summary.currentBranch;
  } catch {}

  if (options.stdout) {
    // Print to stdout instead of writing to file
    const report = await generateGraphReport({
      repoPath: currentDir,
      memoryCount,
      gitBranch
    });
    console.log(report);
  } else {
    const outputPath = await writeGraphReport({
      repoPath: currentDir,
      memoryCount,
      gitBranch
    });
    console.log(chalk.green(`✓ Graph report written to ${outputPath}`));
  }
}
