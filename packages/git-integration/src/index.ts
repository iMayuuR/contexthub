import { ContextHubCore } from '@contexthub/core';
import type { MemoryEntry } from '@contexthub/shared-types';
import simpleGit, { SimpleGit } from 'simple-git';

export class GitIntegration {
  private core: ContextHubCore;
  private git: SimpleGit;
  private repoPath: string;

  constructor(core: ContextHubCore, repoPath: string) {
    this.core = core;
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Save a commit to memory.
   */
  async saveCommit(commit: {
    hash: string;
    message: string;
    author: string;
    date: Date;
    filesChanged: string[];
  }): Promise<string> {
    const memoryId = await this.core.saveMemory({
      sessionId: 'git-integration', // We'll use a fixed session for git events, or we could create a special session type
      type: 'commit',
      content: `Commit ${commit.hash}: ${commit.message}`,
      timestamp: commit.date.getTime(),
      tags: ['git', 'commit', ...commit.filesChanged.map(f => `file:${f}`)]
    });

    return memoryId;
  }

  /**
   * Get recent commits and save them to memory.
   * This would typically be called periodically or after a git operation.
   */
  async processRecentCommits(limit: number = 10): Promise<void> {
    try {
      const log = await this.git.log({ limit });
      for (const commit of log.all) {
        // We would need to check if we have already saved this commit to avoid duplicates.
        // For simplicity, we'll save every commit we see.
        // In a real implementation, we would store the last processed commit hash.
        await this.saveCommit({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date,
          filesChanged: [] // We don't have the list of files in the simple log, we would need to use diff
        });
      }
    } catch (error) {
      console.error('Failed to process recent commits:', error);
    }
  }

  /**
   * Get a summary of the git repository for context.
   */
  async getGitSummary(): Promise<{
    currentBranch: string;
    recentCommits: Array<{ hash: string; message: string; author: string; date: Date }>;
    status: {
      files: {
        added: string[];
        modified: string[];
        deleted: string[];
      };
    };
  }> {
    try {
      const [branch, logResult, statusResult] = await Promise.all([
        this.git.branchCurrent(),
        this.git.log({ limit: 10 }),
        this.git.status()
      ]);

      return {
        currentBranch: branch,
        recentCommits: logResult.all.map(commit => ({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date
        })),
        status: {
          files: {
            added: statusResult.files
              .filter(file => file.working_tree_status === 'A' || file.working_tree_status === '??')
              .map(file => file.path),
            modified: statusResult.files
              .filter(file => file.working_tree_status === 'M')
              .map(file => file.path),
            deleted: statusResult.files
              .filter(file => file.working_tree_status === 'D')
              .map(file => file.path)
          }
        }
      };
    } catch (error) {
      console.error('Failed to get git summary:', error);
      throw error;
    }
  }

  /**
   * Track changes in the working directory and save them as memories.
   * This would be called periodically or via a file watcher.
   */
  async trackChanges(): Promise<void> {
    // This is a placeholder for a file watcher implementation.
    // In a real implementation, we would use chokidar or similar to watch for changes.
    console.log('Tracking changes is not yet implemented.');
  }
}