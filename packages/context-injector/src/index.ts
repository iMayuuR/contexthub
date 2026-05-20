import { ContextHubCore } from '@imayuur/contexthub-core';
import type { MemoryEntry } from '@imayuur/contexthub-shared-types';
import { VectorEngine } from '@imayuur/contexthub-vector-engine';
import { RepoParser } from '@imayuur/contexthub-repo-parser';

export class ContextInjector {
  private core: ContextHubCore;
  private vectorEngine: VectorEngine;
  private repoParser: RepoParser;

  constructor(core: ContextHubCore, vectorEngine: VectorEngine, repoParser: RepoParser) {
    this.core = core;
    this.vectorEngine = vectorEngine;
    this.repoParser = repoParser;
  }

  /**
   * Inject relevant context into a prompt based on the current session and repository state.
   */
  async injectContext(prompt: string, sessionId: string): Promise<string> {
    // 1. Get recent memories from the session
    const recentMemories = await this.core.searchMemories({
      sessionId,
      limit: 10
    });

    // 2. Get project metadata
    const projectMetadata = await this.core.getProjectMetadata();

    // 3. Get related files based on the prompt (simplified)
    // In a real implementation, we would use the vector engine to find similar code
    const relatedFiles: string[] = []; // Placeholder

    // 4. Format the context
    const contextSections: string[] = [];

    if (projectMetadata) {
      contextSections.push(`Project: ${projectMetadata.name}`);
      if (projectMetadata.description) {
        contextSections.push(`Description: ${projectMetadata.description}`);
      }
    }

    if (recentMemories.length > 0) {
      contextSections.push('\nRecent Conversation:');
      recentMemories.forEach((mem, index) => {
        contextSections.push(`${index + 1}. [${mem.type}] ${mem.content}`);
      });
    }

    if (relatedFiles.length > 0) {
      contextSections.push('\nRelated Files:');
      relatedFiles.forEach((file, index) => {
        contextSections.push(`${index + 1}. ${file}`);
      });
    }

    const context = contextSections.join('\n');
    return `${context}\n\nUser Prompt: ${prompt}`;
  }

  /**
   * Save a prompt and response as memories.
   */
  async saveInteraction(sessionId: string, prompt: string, response: string): Promise<void> {
    const timestamp = Date.now();

    // Save prompt
    await this.core.saveMemory({
      sessionId,
      type: 'prompt',
      content: prompt,
      timestamp,
      tags: ['prompt']
    });

    // Save response
    await this.core.saveMemory({
      sessionId,
      type: 'response',
      content: response,
      timestamp,
      tags: ['response']
    });
  }

  /**
   * Generate a summary of the repository for context.
   */
  async generateRepoSummary(): Promise<string> {
    const projectMetadata = await this.core.getProjectMetadata();
    const memories = await this.core.searchMemories({ limit: 50 });

    // In a real implementation, we would use an LLM to summarize, but we'll do a simple version here.
    let summary = `Repository: ${projectMetadata?.name || 'Unknown'}\n`;
    if (projectMetadata?.description) {
      summary += `Description: ${projectMetadata.description}\n`;
    }
    summary += `Total memories: ${memories.length}\n`;

    // Count by type
    const typeCounts: Record<string, number> = {};
    memories.forEach(mem => {
      typeCounts[mem.type] = (typeCounts[mem.type] || 0) + 1;
    });
    summary += 'Memory types: ' + Object.entries(typeCounts).map(([type, count]) => `${type}:${count}`).join(', ') + '\n';

    return summary;
  }
}