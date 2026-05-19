import { ContextHubCore, SecurityManager } from '@contexthub/core';
import type { Session, MemoryEntry } from '@contexthub/shared-types';

// Base class for agent connectors
export abstract class AgentConnector {
  protected core: ContextHubCore;
  protected agentName: string;
  protected security: SecurityManager;

  constructor(core: ContextHubCore, agentName: string, repoPath?: string) {
    this.core = core;
    this.agentName = agentName;
    this.security = new SecurityManager(repoPath || process.cwd());
  }

  /**
   * Called before sending a prompt to the agent.
   * Should fetch relevant context and modify the prompt.
   */
  abstract preprocessPrompt(prompt: string, sessionId: string): Promise<string>;

  /**
   * Called after receiving a response from the agent.
   * Should save the interaction and update any internal state.
   */
  abstract postprocessResponse(prompt: string, response: string, sessionId: string): Promise<void>;

  /**
   * Safely save content to memory with sanitization and redaction.
   */
  protected async safeSaveMemory(sessionId: string, type: string, content: string, tags: string[]): Promise<void> {
    // Sanitize content
    let sanitized = this.security.sanitizeInput(content);

    // Redact sensitive data (API keys, passwords, tokens)
    if (this.security.isSensitive(sanitized)) {
      sanitized = this.security.redactSensitive(sanitized);
    }

    // Validate type
    const validType = this.security.validateMemoryType(type);

    // Sanitize tags
    const safeTags = tags
      .map(t => this.security.sanitizeInput(t, 100))
      .filter(t => t.length > 0)
      .slice(0, 20);

    await this.core.saveMemory({
      sessionId,
      type: validType as any,
      content: sanitized,
      timestamp: Date.now(),
      tags: safeTags
    });
  }

  /**
   * Called when the agent session starts.
   */
  async onSessionStart(sessionId: string): Promise<void> {
    // Default implementation: do nothing
  }

  /**
   * Called when the agent session ends.
   */
  async onSessionEnd(sessionId: string): Promise<void> {
    // Default implementation: do nothing
  }
}

// Specific connectors for different agents can extend this base class.

export class ClaudeCodeConnector extends AgentConnector {
  constructor(core: ContextHubCore, repoPath?: string) {
    super(core, 'claude-code', repoPath);
  }

  async preprocessPrompt(prompt: string, sessionId: string): Promise<string> {
    // Fetch relevant context and inject it into the prompt
    // For now, we'll just return the prompt as is.
    // In a real implementation, we would use the context injector.
    return prompt;
  }

  async postprocessResponse(prompt: string, response: string, sessionId: string): Promise<void> {
    // Use safeSaveMemory — sanitized + redacted
    await this.safeSaveMemory(sessionId, 'prompt', prompt, ['prompt', 'claude-code']);
    await this.safeSaveMemory(sessionId, 'response', response, ['response', 'claude-code']);
  }
}

export class CursorConnector extends AgentConnector {
  constructor(core: ContextHubCore, repoPath?: string) {
    super(core, 'cursor', repoPath);
  }

  async preprocessPrompt(prompt: string, sessionId: string): Promise<string> {
    return prompt;
  }

  async postprocessResponse(prompt: string, response: string, sessionId: string): Promise<void> {
    // Use safeSaveMemory — sanitized + redacted
    await this.safeSaveMemory(sessionId, 'prompt', prompt, ['prompt', 'cursor']);
    await this.safeSaveMemory(sessionId, 'response', response, ['response', 'cursor']);
  }
}

// We can add more connectors for other agents (OpenCode, Antigravity, etc.) as needed.

// Factory to create connectors
export function createConnector(agentName: string, core: ContextHubCore): AgentConnector {
  switch (agentName) {
    case 'claude-code':
      return new ClaudeCodeConnector(core);
    case 'cursor':
      return new CursorConnector(core);
    // Add more cases for other agents
    default:
      throw new Error(`Unsupported agent: ${agentName}`);
  }
}