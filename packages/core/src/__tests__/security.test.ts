import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { SecurityManager } from '../security';

describe('SecurityManager', () => {
  const repoPath = path.resolve(process.cwd());
  const security = new SecurityManager(repoPath);

  test('validatePath - prevents path traversal', () => {
    // Valid paths
    const validPath = path.join(repoPath, 'src/index.ts');
    assert.strictEqual(security.validatePath(validPath), validPath);

    // Relative paths should be resolved to absolute, but here validatePath expects absolute paths
    // Actually, let's check what validatePath does. Wait, let me check the implementation.
    // If we pass an outside path, it should throw.
    const outsidePath = path.resolve(repoPath, '../outside.ts');
    assert.throws(() => {
      security.validatePath(outsidePath);
    }, /Path traversal detected/);

    const maliciousPath = path.join(repoPath, 'src/../../etc/passwd');
    assert.throws(() => {
      security.validatePath(maliciousPath);
    }, /Path traversal detected/);
  });

  test('Encryption and Decryption', () => {
    const originalText = 'Super secret sensitive token: ghp_123456789012345678901234567890123456';
    
    // Encrypt
    const encrypted = security.encrypt(originalText);
    assert.notStrictEqual(encrypted, originalText);
    assert.ok(encrypted.length > 0);
    // Base64 format string
    assert.ok(/^[a-zA-Z0-9+/=]+$/.test(encrypted));

    // Decrypt
    const decrypted = security.decrypt(encrypted);
    assert.strictEqual(decrypted, originalText);
  });

  test('Input Sanitization - 50KB limit', () => {
    const smallText = 'Hello world';
    assert.strictEqual(security.sanitizeInput(smallText), smallText);

    const largeText = 'A'.repeat(60000); // 60KB
    const sanitized = security.sanitizeInput(largeText);
    assert.strictEqual(sanitized.length, 51200); // MAX_INPUT_LENGTH
  });

  test('Sensitive Data Detection', () => {
    assert.ok(security.isSensitive('export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE'));
    assert.ok(security.isSensitive('const token = "ghp_123456789012345678901234567890123456";'));
    assert.ok(!security.isSensitive('Just a normal log message without secrets'));
  });

  test('Redaction', () => {
    const log = 'Error: AWS key AKIAIOSFODNN7EXAMPLE is invalid';
    const redacted = security.redactSensitive(log);
    assert.strictEqual(redacted, 'Error: AWS key [REDACTED] is invalid');
  });
});
