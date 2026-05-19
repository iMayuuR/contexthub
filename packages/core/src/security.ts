/**
 * SecurityManager — Centralized security module for ContextHub
 *
 * Provides:
 * - AES-256-GCM encryption/decryption for data at rest
 * - Key management with auto-generation
 * - Input sanitization and validation
 * - Sensitive pattern detection (API keys, passwords, tokens)
 * - Path traversal prevention
 * - Auth token generation/verification for MCP
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;        // NIST-recommended for GCM
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;       // 256 bits
const SALT_PREFIX = 'contexthub-v1-';

const MAX_INPUT_LENGTH = 51200;   // 50KB default
const MAX_QUERY_LENGTH = 1000;
const MAX_MEMORY_ENTRIES = 10000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Patterns that indicate sensitive data that should NOT be stored in memory.
 * Each pattern is tested case-insensitively against command/content text.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  // API keys and tokens
  /(?:api[_-]?key|apikey)\s*[=:]\s*\S+/i,
  /(?:secret[_-]?key|secretkey)\s*[=:]\s*\S+/i,
  /(?:access[_-]?token|accesstoken)\s*[=:]\s*\S+/i,
  /(?:auth[_-]?token|authtoken)\s*[=:]\s*\S+/i,
  /(?:bearer)\s+\S+/i,
  /(?:token)\s*[=:]\s*\S{20,}/i,

  // Common key prefixes
  /sk-[a-zA-Z0-9_-]{10,}/,           // OpenAI / Stripe style (sk-proj-xxx, sk-xxx)
  /ghp_[a-zA-Z0-9]{36,}/,          // GitHub PAT
  /glpat-[a-zA-Z0-9]{20,}/,        // GitLab PAT
  /xox[bpras]-[a-zA-Z0-9-]{10,}/,  // Slack tokens
  /AKIA[0-9A-Z]{16}/,              // AWS Access Key

  // Passwords and credentials
  /(?:password|passwd|pwd)\s*[=:]\s*\S+/i,
  /(?:mysql|postgres|redis|mongo).*-p\s*\S+/i,
  /-p\s*['"]?[^\s'"]+['"]?\s/,     // CLI password flags

  // SSH and certificates
  /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH)?\s*PRIVATE\s+KEY-----/,
  /-----BEGIN\s+CERTIFICATE-----/,

  // Environment variable exports with sensitive names
  /export\s+(?:\w*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH)\w*)\s*=/i,

  // Connection strings
  /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^@\s]+:[^@\s]+@/i,
];

/**
 * File patterns to exclude from repo parsing (contain secrets or certs).
 */
export const SENSITIVE_FILE_PATTERNS: string[] = [
  '.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx', '*.jks',
  '*.keystore', 'credentials*', 'secrets*', '.npmrc', '.pypirc',
  'id_rsa*', 'id_ed25519*', '*.crt', '*.cert',
];

// ─── SecurityManager ─────────────────────────────────────────────────────────

export class SecurityManager {
  private repoPath: string;
  private keyPath: string;
  private encryptionKey: Buffer | null = null;

  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath);
    this.keyPath = path.join(this.repoPath, '.contexthub', '.keyfile');
  }

  // ── Key Management ──────────────────────────────────────────────────────

  /**
   * Get or create the encryption key.
   * Priority: CONTEXTHUB_KEY env var > .keyfile on disk > auto-generate
   */
  private getKey(): Buffer {
    if (this.encryptionKey) return this.encryptionKey;

    // 1. Check environment variable
    const envKey = process.env.CONTEXTHUB_KEY;
    if (envKey && envKey.length > 0) {
      // Use per-repo unique salt derived from repo path
      const repoSalt = SALT_PREFIX + crypto.createHash('sha256').update(this.repoPath).digest('hex').slice(0, 16);
      this.encryptionKey = crypto.scryptSync(envKey, repoSalt, KEY_LENGTH);
      return this.encryptionKey;
    }

    // 2. Check .keyfile on disk
    if (fs.existsSync(this.keyPath)) {
      try {
        const keyHex = fs.readFileSync(this.keyPath, 'utf-8').trim();
        this.encryptionKey = Buffer.from(keyHex, 'hex');
        if (this.encryptionKey.length !== KEY_LENGTH) {
          throw new Error('Invalid key length in .keyfile');
        }
        return this.encryptionKey;
      } catch {
        // Key file corrupted — regenerate
      }
    }

    // 3. Auto-generate new key
    this.encryptionKey = crypto.randomBytes(KEY_LENGTH);
    this.saveKeyFile(this.encryptionKey);
    return this.encryptionKey;
  }

  /**
   * Save encryption key to disk with restrictive permissions (owner-only).
   */
  private saveKeyFile(key: Buffer): void {
    const dir = path.dirname(this.keyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(this.keyPath, key.toString('hex'), { mode: 0o600 });
  }

  // ── Encryption ──────────────────────────────────────────────────────────

  /**
   * Encrypt plaintext string using AES-256-GCM.
   * Returns base64-encoded string: IV (12B) + AuthTag (16B) + Ciphertext
   */
  encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Combine: IV + AuthTag + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt a base64-encoded encrypted string.
   * Verifies auth tag to detect tampering.
   */
  decrypt(encryptedBase64: string): string {
    const key = this.getKey();
    const combined = Buffer.from(encryptedBase64, 'base64');

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted data: too short');
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  }

  /**
   * Check if data looks like it's already encrypted (base64 with correct prefix length).
   */
  isEncrypted(data: string): boolean {
    try {
      const buf = Buffer.from(data, 'base64');
      // Must be at least IV + AuthTag + 1 byte of ciphertext
      return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1 &&
             data === buf.toString('base64'); // Valid base64 round-trip
    } catch {
      return false;
    }
  }

  // ── Input Validation ────────────────────────────────────────────────────

  /**
   * Sanitize user input: trim, enforce max length, strip control characters.
   */
  sanitizeInput(input: string, maxLen: number = MAX_INPUT_LENGTH): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    // Strip null bytes and dangerous control characters (keep \n, \r, \t)
    let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Enforce max length
    if (sanitized.length > maxLen) {
      sanitized = sanitized.substring(0, maxLen);
    }

    return sanitized.trim();
  }

  /**
   * Validate a query string (shorter max length).
   */
  sanitizeQuery(query: string): string {
    return this.sanitizeInput(query, MAX_QUERY_LENGTH);
  }

  /**
   * Validate a numeric limit parameter.
   */
  validateLimit(limit: number | undefined, min: number = 1, max: number = 100): number {
    if (limit === undefined || limit === null) return max;
    const num = Math.floor(Number(limit));
    if (isNaN(num) || num < min) return min;
    if (num > max) return max;
    return num;
  }

  /**
   * Validate a port number.
   */
  validatePort(port: number): number {
    const num = Math.floor(Number(port));
    if (isNaN(num) || num < 1024 || num > 65535) {
      throw new Error(`Invalid port: ${port}. Must be between 1024 and 65535.`);
    }
    return num;
  }

  /**
   * Validate memory type against allowed values.
   */
  validateMemoryType(type: string): string {
    const ALLOWED_TYPES = ['prompt', 'response', 'summary', 'decision', 'architecture', 'bugfix', 'manual', 'commit'];
    const normalized = type.toLowerCase().trim();
    if (!ALLOWED_TYPES.includes(normalized)) {
      return 'manual'; // Default to 'manual' for unknown types
    }
    return normalized;
  }

  // ── Sensitive Data Detection ────────────────────────────────────────────

  /**
   * Check if text contains sensitive patterns (API keys, passwords, etc.).
   * Returns true if the text should NOT be stored.
   */
  isSensitive(text: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Redact sensitive parts of text, replacing matched patterns with [REDACTED].
   */
  redactSensitive(text: string): string {
    let result = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }
    return result;
  }

  // ── Path Validation ─────────────────────────────────────────────────────

  /**
   * Validate that a path resolves within the repo boundary.
   * Prevents directory traversal attacks.
   */
  validatePath(inputPath: string): string {
    const resolved = path.resolve(this.repoPath, inputPath);

    // Ensure the resolved path starts with the repo path
    if (!resolved.startsWith(this.repoPath + path.sep) && resolved !== this.repoPath) {
      throw new Error('Path traversal detected: path escapes repository boundary');
    }

    return resolved;
  }

  /**
   * Check if a filename matches sensitive file patterns.
   */
  isSensitiveFile(filePath: string): boolean {
    const basename = path.basename(filePath).toLowerCase();
    return SENSITIVE_FILE_PATTERNS.some(pattern => {
      // Convert glob-like pattern to simple check
      const p = pattern.toLowerCase();
      if (p.startsWith('*.')) {
        return basename.endsWith(p.slice(1));
      }
      if (p.endsWith('*')) {
        return basename.startsWith(p.slice(0, -1));
      }
      if (p.includes('.*')) {
        const prefix = p.split('.*')[0];
        return basename.startsWith(prefix);
      }
      return basename === p;
    });
  }

  // ── Auth Token ──────────────────────────────────────────────────────────

  /**
   * Generate an HMAC-based auth token for MCP server authentication.
   */
  generateAuthToken(): string {
    const key = this.getKey();
    const payload = `contexthub-auth-${Date.now()}`;
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(payload);
    const token = `${Buffer.from(payload).toString('base64')}.${hmac.digest('hex')}`;

    // Store the token
    const tokenPath = path.join(this.repoPath, '.contexthub', '.auth-token');
    fs.writeFileSync(tokenPath, token, { mode: 0o600 });

    return token;
  }

  /**
   * Verify an auth token. Returns true if valid.
   */
  verifyAuthToken(token: string): boolean {
    try {
      const tokenPath = path.join(this.repoPath, '.contexthub', '.auth-token');
      if (!fs.existsSync(tokenPath)) return false;

      const storedToken = fs.readFileSync(tokenPath, 'utf-8').trim();

      // Hash both tokens to fixed length before comparison
      // This prevents timingSafeEqual from crashing on length mismatch
      // and avoids leaking length information
      const hashA = crypto.createHash('sha256').update(token).digest();
      const hashB = crypto.createHash('sha256').update(storedToken).digest();
      return crypto.timingSafeEqual(hashA, hashB);
    } catch {
      return false;
    }
  }

  /**
   * Check if auth is required (CONTEXTHUB_TOKEN env var is set).
   */
  isAuthRequired(): boolean {
    return !!process.env.CONTEXTHUB_TOKEN;
  }

  // ── File Safety ─────────────────────────────────────────────────────────

  /**
   * Check file size before reading. Throws if too large.
   */
  checkFileSize(filePath: string, maxBytes: number = MAX_FILE_SIZE_BYTES): void {
    if (!fs.existsSync(filePath)) return;
    const stats = fs.statSync(filePath);
    if (stats.size > maxBytes) {
      throw new Error(`File too large: ${filePath} (${stats.size} bytes, max ${maxBytes})`);
    }
  }

  /**
   * Set secure permissions on a file or directory.
   */
  setSecurePermissions(targetPath: string, isDirectory: boolean = false): void {
    try {
      const mode = isDirectory ? 0o700 : 0o600;
      fs.chmodSync(targetPath, mode);
    } catch {
      // Some platforms may not support chmod — log but don't fail
      console.error(`Warning: Could not set permissions on ${targetPath}`);
    }
  }

  // ── Constants Accessors ─────────────────────────────────────────────────

  get maxMemoryEntries(): number { return MAX_MEMORY_ENTRIES; }
  get maxInputLength(): number { return MAX_INPUT_LENGTH; }
  get maxQueryLength(): number { return MAX_QUERY_LENGTH; }
  get maxFileSizeBytes(): number { return MAX_FILE_SIZE_BYTES; }
}
