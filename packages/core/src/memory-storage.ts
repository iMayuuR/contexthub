// @ts-ignore
const crypto = require('crypto');
// @ts-ignore
const path = require('path');
// @ts-ignore
const fs = require('fs');
import { Session, MemoryEntry, ProjectMetadata } from '@contexthub/shared-types';

export class MemoryStorage {
  private repoPath: string;
  private contexthubPath: string;
  private sessionsPath: string;
  private memoriesPath: string;
  private projectMetadataPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.contexthubPath = path.join(repoPath, '.contexthub');
    this.sessionsPath = path.join(this.contexthubPath, 'sessions.json');
    this.memoriesPath = path.join(this.contexthubPath, 'memories.json');
    this.projectMetadataPath = path.join(this.contexthubPath, 'project-metadata.json');

    // Create .contexthub directory if it doesn't exist
    if (!fs.existsSync(this.contexthubPath)) {
      fs.mkdirSync(this.contexthubPath, { recursive: true });
    }

    // Initialize files if they don't exist
    this.initFile(this.sessionsPath, []);
    this.initFile(this.memoriesPath, []);
    this.initFile(this.projectMetadataPath, null);
  }

  private initFile(filePath: string, defaultContent: any): void {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
    }
  }

  private readJSONFile<T>(filePath: string): T {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }

  private writeJSONFile<T>(filePath: string, data: T): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // Session management
  async createSession(agent: string, metadata: Record<string, any> = {}): Promise<string> {
    const id = crypto.randomUUID();
    const startTime = Date.now();

    const session: Session = {
      id,
      repoPath: this.repoPath,
      startTime,
      agent,
      metadata
    };

    const sessions = this.readJSONFile<Session[]>(this.sessionsPath);
    sessions.push(session);
    this.writeJSONFile(this.sessionsPath, sessions);

    return id;
  }

  async endSession(sessionId: string): Promise<void> {
    const sessions = this.readJSONFile<Session[]>(this.sessionsPath);
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].endTime = Date.now();
      this.writeJSONFile(this.sessionsPath, sessions);
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const sessions = this.readJSONFile<Session[]>(this.sessionsPath);
    return sessions.find(s => s.id === sessionId) || null;
  }

  async getSessions(limit?: number): Promise<Session[]> {
    let sessions = this.readJSONFile<Session[]>(this.sessionsPath);
    sessions.sort((a, b) => b.startTime - a.startTime); // descending by startTime
    if (limit !== undefined) {
      sessions = sessions.slice(0, limit);
    }
    return sessions;
  }

  // Memory management
  async saveMemory(memory: Omit<MemoryEntry, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    const memoryWithId: MemoryEntry = { ...memory, id };

    const memories = this.readJSONFile<MemoryEntry[]>(this.memoriesPath);
    memories.push(memoryWithId);
    this.writeJSONFile(this.memoriesPath, memories);

    return id;
  }

  async getMemory(id: string): Promise<MemoryEntry | null> {
    const memories = this.readJSONFile<MemoryEntry[]>(this.memoriesPath);
    return memories.find(mem => mem.id === id) || null;
  }

  async searchMemories(options: {
    sessionId?: string;
    type?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<MemoryEntry[]> {
    let memories = this.readJSONFile<MemoryEntry[]>(this.memoriesPath);

    if (options.sessionId) {
      memories = memories.filter(mem => mem.sessionId === options.sessionId);
    }

    if (options.type) {
      memories = memories.filter(mem => mem.type === options.type);
    }

    if (options.tags && options.tags.length > 0) {
      const tags = options.tags;
      memories = memories.filter(mem =>
        tags.some(tag => mem.tags.includes(tag))
      );
    }

    memories.sort((a, b) => b.timestamp - a.timestamp); // descending by timestamp

    if (options.offset !== undefined) {
      memories = memories.slice(options.offset);
    }

    if (options.limit !== undefined) {
      memories = memories.slice(0, options.limit);
    }

    return memories;
  }

  // Project metadata
  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    this.writeJSONFile(this.projectMetadataPath, metadata);
  }

  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    try {
      return this.readJSONFile<ProjectMetadata | null>(this.projectMetadataPath);
    } catch (e) {
      return null;
    }
  }

  // Cleanup
  async close(): Promise<void> {
    // Nothing to clean up
  }
}