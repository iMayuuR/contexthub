import { MemoryStorage } from './memory-storage';
import { SecurityManager } from './security';
import type { Session, MemoryEntry, ProjectMetadata } from '@contexthub/shared-types';

export { SecurityManager } from './security';


export class ContextHubCore {
  private storage: MemoryStorage;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.storage = new MemoryStorage(repoPath);
  }

  async initStorage(): Promise<void> {
    // The storage is initialized in the constructor
    // This method is for any additional initialization if needed
  }

  // Session management
  async createSession(agent: string, metadata: Record<string, any> = {}): Promise<string> {
    return this.storage.createSession(agent, metadata);
  }

  async endSession(sessionId: string): Promise<void> {
    return this.storage.endSession(sessionId);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.storage.getSession(sessionId);
  }

  async getSessions(limit?: number): Promise<Session[]> {
    return this.storage.getSessions(limit);
  }

  // Memory management
  async saveMemory(memory: Omit<MemoryEntry, 'id'>): Promise<string> {
    return this.storage.saveMemory(memory);
  }

  async getMemory(id: string): Promise<MemoryEntry | null> {
    return this.storage.getMemory(id);
  }

  async searchMemories(options: {
    sessionId?: string;
    type?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<MemoryEntry[]> {
    return this.storage.searchMemories(options);
  }

  // Project metadata
  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    return this.storage.saveProjectMetadata(metadata);
  }

  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    return this.storage.getProjectMetadata();
  }

  // Cleanup
  async close(): Promise<void> {
    await this.storage.close();
  }
}