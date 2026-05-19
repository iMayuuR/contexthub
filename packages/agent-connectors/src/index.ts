import { ContextHubCore } from '@contexthub/core';
import type { Session, MemoryEntry } from '@contexthub/shared-types';

// Base class for agent connectors
export abstract class AgentConnector {
  protected core: ContextHubCore;
  protected agentName: string;

  constructor(core: ContextHubCore, agentName: string) {
    this.core = core;
    this.agentName = agentName;
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
  constructor(core: ContextHubCore) {
    super(core, 'claude-code');
  }

  async preprocessPrompt(prompt: string, sessionId: string): Promise<string> {
    // Fetch relevant context and inject it into the prompt
    // For now, we'll just return the prompt as is.
    // In a real implementation, we would use the context injector.
    return prompt;
  }

  async postprocessResponse(prompt: string, response: string, sessionId: string): Promise<void> {
    // Save the interaction
    const core = this.core;
    await core.saveMemory({
      sessionId,
      type: 'prompt',
      content: prompt,
      timestamp: Date.now(),
      tags: ['prompt', 'claude-code']
    });

    await core.saveMemory({
      sessionId,
      type: 'response',
      content: response,
      timestamp: Date.now(),
      tags: ['response', 'claude-code']
    });
  }
}

export class CursorConnector extends AgentConnector {
  constructor(core: ContextHubCore) {
    super(core, 'cursor');
  }

  async preprocessPrompt(prompt: string, sessionId: string): Promise<string> {
    return prompt;
  }

  async postprocessResponse(prompt: string, response: string, sessionId: string): Promise<void> {
    const core = this.core;
    await core.saveMemory({
      sessionId,
      type: 'prompt',
      content: prompt,
      timestamp: Date.now(),
      tags: ['prompt', 'cursor']
    });

    await core.saveMemory({
      sessionId,
      type: 'response',
      content: response,
      timestamp: Date.now(),
      tags: ['response', 'cursor']
    });
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