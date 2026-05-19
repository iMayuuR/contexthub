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
    date: string;
    filesChanged: string[];
  }): Promise<string> {
    const memoryId = await this.core.saveMemory({
      sessionId: 'git-integration', // We'll use a fixed session for git events
      type: 'commit',
      content: `Commit ${commit.hash}: ${commit.message}`,
      timestamp: new Date(commit.date).getTime(),
      tags: ['git', 'commit', ...commit.filesChanged.map((f: string) => `file:${f}`)]
    });

    return memoryId;
  }

  /**
   * Get recent commits and save them to memory.
   */
  async processRecentCommits(limit: number = 10): Promise<void> {
    try {
      const log = await this.git.log({ maxCount: limit });
      for (const commit of log.all) {
        await this.saveCommit({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date,
          filesChanged: []
        });
      }
    } catch (error: any) {
      console.error('Failed to process recent commits:', error?.message || 'unknown error');
    }
  }

  /**
   * Get a summary of the git repository for context.
   */
  async getGitSummary(): Promise<{
    currentBranch: string;
    recentCommits: Array<{ hash: string; message: string; author: string; date: string }>;
    status: {
      files: {
        added: string[];
        modified: string[];
        deleted: string[];
      };
    };
  }> {
    try {
      const [branchResult, logResult, statusResult] = await Promise.all([
        this.git.branch(),
        this.git.log({ maxCount: 10 }),
        this.git.status()
      ]);

      return {
        currentBranch: branchResult.current,
        recentCommits: logResult.all.map((commit: any) => ({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date
        })),
        status: {
          files: {
            added: statusResult.files
              .filter((file: any) => file.working_dir === '?' || file.index === 'A')
              .map((file: any) => file.path),
            modified: statusResult.files
              .filter((file: any) => file.working_dir === 'M' || file.index === 'M')
              .map((file: any) => file.path),
            deleted: statusResult.files
              .filter((file: any) => file.working_dir === 'D' || file.index === 'D')
              .map((file: any) => file.path)
          }
        }
      };
    } catch (error: any) {
      console.error('Failed to get git summary:', error?.message || 'unknown error');
      throw error;
    }
  }

  /**
   * Track changes in the working directory.
   * Placeholder for future file watcher implementation.
   */
  async trackChanges(): Promise<void> {
    console.error('Tracking changes is not yet implemented.');
  }
}