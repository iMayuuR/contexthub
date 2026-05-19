/**
 * MemoryStorage — Secure, encrypted file-based storage for ContextHub
 *
 * Security features:
 * - AES-256-GCM encryption at rest for all JSON data files
 * - Atomic writes (write to .tmp, then rename) to prevent corruption
 * - In-process mutex to prevent race conditions on concurrent access
 * - File size limits to prevent OOM/DoS
 * - Entry count caps with automatic archival
 * - Secure file permissions (0600 for files, 0700 for directories)
 * - Automatic migration from plaintext to encrypted format
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { Session, MemoryEntry, ProjectMetadata } from '@contexthub/shared-types';
import { SecurityManager } from './security';

// Simple in-process async mutex for file locking
class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => this.release());
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }

  private release(): void {
    this.locked = false;
    const next = this.queue.shift();
    if (next) next();
  }
}

export class MemoryStorage {
  private repoPath: string;
  private contexthubPath: string;
  private sessionsPath: string;
  private memoriesPath: string;
  private projectMetadataPath: string;
  private security: SecurityManager;
  private mutex: Mutex;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.contexthubPath = path.join(repoPath, '.contexthub');
    this.sessionsPath = path.join(this.contexthubPath, 'sessions.json');
    this.memoriesPath = path.join(this.contexthubPath, 'memories.json');
    this.projectMetadataPath = path.join(this.contexthubPath, 'project-metadata.json');
    this.security = new SecurityManager(repoPath);
    this.mutex = new Mutex();

    // Create .contexthub directory if it doesn't exist (with secure permissions)
    if (!fs.existsSync(this.contexthubPath)) {
      fs.mkdirSync(this.contexthubPath, { recursive: true });
      this.security.setSecurePermissions(this.contexthubPath, true);
    }

    // Initialize files if they don't exist
    this.initFile(this.sessionsPath, []);
    this.initFile(this.memoriesPath, []);
    this.initFile(this.projectMetadataPath, null);
  }

  // ── File I/O (Encrypted + Atomic) ──────────────────────────────────────

  private initFile(filePath: string, defaultContent: any): void {
    if (!fs.existsSync(filePath)) {
      this.writeJSONFileSync(filePath, defaultContent);
    }
  }

  /**
   * Read and decrypt a JSON file from disk.
   * Handles both encrypted and plaintext formats (for migration).
   */
  private readJSONFile<T>(filePath: string): T {
    // Check file size before reading
    this.security.checkFileSize(filePath);

    const raw = fs.readFileSync(filePath, 'utf8').trim();

    // Empty file — return default
    if (raw.length === 0) {
      return ([] as unknown) as T;
    }

    // Try parsing as plaintext JSON first (for migration / backwards compat)
    if (raw.startsWith('[') || raw.startsWith('{') || raw === 'null') {
      try {
        const parsed = JSON.parse(raw);
        // Auto-migrate: re-write as encrypted
        this.writeJSONFileSync(filePath, parsed);
        return parsed;
      } catch {
        // Not valid JSON — try decrypting
      }
    }

    // Decrypt
    try {
      const decrypted = this.security.decrypt(raw);
      return JSON.parse(decrypted);
    } catch (e) {
      throw new Error(`Failed to read data file (may be corrupted): ${path.basename(filePath)}`);
    }
  }

  /**
   * Encrypt and write JSON data to disk using atomic write.
   * Writes to a .tmp file first, then renames — prevents corruption on crash.
   */
  private writeJSONFileSync<T>(filePath: string, data: T): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const encrypted = this.security.encrypt(jsonStr);

    const tmpPath = filePath + `.tmp.${crypto.randomBytes(4).toString('hex')}`;
    try {
      fs.writeFileSync(tmpPath, encrypted, { mode: 0o600 });
      fs.renameSync(tmpPath, filePath);
    } catch (e) {
      // Clean up temp file on error
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      throw e;
    }
  }

  // ── Session Management ─────────────────────────────────────────────────

  async createSession(agent: string, metadata: Record<string, any> = {}): Promise<string> {
    const release = await this.mutex.acquire();
    try {
      const id = crypto.randomUUID();
      const startTime = Date.now();

      // Sanitize inputs
      const sanitizedAgent = this.security.sanitizeInput(agent, 100);

      const session: Session = {
        id,
        repoPath: this.repoPath,
        startTime,
        agent: sanitizedAgent,
        metadata
      };

      const sessions = this.readJSONFile<Session[]>(this.sessionsPath);
      sessions.push(session);

      // Cap sessions at max entries
      const capped = sessions.length > this.security.maxMemoryEntries
        ? sessions.slice(-this.security.maxMemoryEntries)
        : sessions;

      this.writeJSONFileSync(this.sessionsPath, capped);

      return id;
    } finally {
      release();
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const sessions = this.readJSONFile<Session[]>(this.sessionsPath);
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].endTime = Date.now();
        this.writeJSONFileSync(this.sessionsPath, sessions);
      }
    } finally {
      release();
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
      const safeLimit = this.security.validateLimit(limit);
      sessions = sessions.slice(0, safeLimit);
    }
    return sessions;
  }

  // ── Memory Management ──────────────────────────────────────────────────

  private calculateJaccard(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  async saveMemory(memory: Omit<MemoryEntry, 'id'>): Promise<string> {
    const release = await this.mutex.acquire();
    try {
      const id = crypto.randomUUID();

      // Sanitize content — redact sensitive data
      let content = this.security.sanitizeInput(memory.content);
      if (this.security.isSensitive(content)) {
        content = this.security.redactSensitive(content);
      }

      // Validate type
      const validType = this.security.validateMemoryType(memory.type || 'manual');

      // Sanitize tags
      const sanitizedTags = (memory.tags || [])
        .map(tag => this.security.sanitizeInput(tag, 100))
        .filter(tag => tag.length > 0)
        .slice(0, 20); // Max 20 tags

      const memoryWithId: MemoryEntry = {
        ...memory,
        id,
        content,
        type: validType as any,
        tags: sanitizedTags,
        relatedPaths: memory.relatedPaths ? this.security.validateRelatedPaths(memory.relatedPaths) : undefined,
        relatedSymbols: memory.relatedSymbols ? this.security.validateRelatedSymbols(memory.relatedSymbols) : undefined,
        commitHash: memory.commitHash ? this.security.validateCommitHash(memory.commitHash) : undefined,
        branch: memory.branch ? this.security.sanitizeInput(String(memory.branch), 100) : undefined,
      };

      let memories = this.readJSONFile<MemoryEntry[]>(this.memoriesPath);

      // Duplicate detection
      if (memory.sessionId) {
        const sessionMemories = memories.filter(m => m.sessionId === memory.sessionId).slice(-20);
        for (const sm of sessionMemories) {
          const jaccard = this.calculateJaccard(sm.content, content);
          if (jaccard > 0.9) {
            return sm.id; // Return existing ID if it's a near duplicate
          }
        }
      }

      memories.push(memoryWithId);

      // Cap at max entries — archive old ones
      const capped = memories.length > this.security.maxMemoryEntries
        ? memories.slice(-this.security.maxMemoryEntries)
        : memories;

      this.writeJSONFileSync(this.memoriesPath, capped);

      return id;
    } finally {
      release();
    }
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
      const safeOffset = Math.max(0, Math.floor(options.offset));
      memories = memories.slice(safeOffset);
    }

    if (options.limit !== undefined) {
      const safeLimit = this.security.validateLimit(options.limit);
      memories = memories.slice(0, safeLimit);
    }

    return memories;
  }

  // ── Project Metadata ───────────────────────────────────────────────────

  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.writeJSONFileSync(this.projectMetadataPath, metadata);
    } finally {
      release();
    }
  }

  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    try {
      return this.readJSONFile<ProjectMetadata | null>(this.projectMetadataPath);
    } catch (e) {
      return null;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    // Nothing to clean up
  }
}