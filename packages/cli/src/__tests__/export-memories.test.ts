import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ContextHubCore } from '@imayuur/contexthub-core';
import { exportMemoriesCommand } from '../commands/export-memories';

test('Export Memories Command', async (t) => {
  const tempRepoDir = path.resolve(__dirname, '../../../../temp-test-export-repo');
  const contexthubDir = path.join(tempRepoDir, '.contexthub');

  // Setup temp repo
  if (fs.existsSync(tempRepoDir)) {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  }
  fs.mkdirSync(contexthubDir, { recursive: true });

  // Create keyfile
  const keyfile = path.join(contexthubDir, '.keyfile');
  fs.writeFileSync(keyfile, crypto.randomBytes(32).toString('hex'));

  // Switch process CWD to tempRepoDir for the command execution
  const originalCwd = process.cwd();
  process.chdir(tempRepoDir);

  t.after(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempRepoDir)) {
      fs.rmSync(tempRepoDir, { recursive: true, force: true });
    }
  });

  await t.test('exports secure memories with scrypt + aes-256-gcm correctly', async () => {
    // 1. Save dummy memories
    const core = new ContextHubCore(tempRepoDir);
    await core.initStorage();

    const sessionId = await core.createSession('test-session', { source: 'unit-test' });
    await core.saveMemory({
      sessionId,
      type: 'decision',
      content: 'This is secure memory content 1',
      timestamp: Date.now(),
      tags: ['export-test']
    });

    await core.saveMemory({
      sessionId,
      type: 'bugfix',
      content: 'A completely different memory content for the second item to bypass similarity checks',
      timestamp: Date.now(),
      tags: ['export-test']
    });

    await core.endSession(sessionId);
    await core.close();

    // 2. Export memories
    const outPath = path.join(tempRepoDir, 'bundle.chub');
    const passphrase = 'SuperSecurePassphrase123!';
    
    await exportMemoriesCommand({
      out: outPath,
      passphrase
    });

    assert.ok(fs.existsSync(outPath), 'bundle.chub file should exist');

    // 3. Verify bundle decryption
    const bundle = fs.readFileSync(outPath);
    assert.ok(bundle.length > 44, 'bundle must contain salt, iv, tag and ciphertext');

    // salt (16B) + iv (12B) + authTag (16B) + ciphertext
    const salt = bundle.subarray(0, 16);
    const iv = bundle.subarray(16, 28);
    const authTag = bundle.subarray(28, 44);
    const ciphertext = bundle.subarray(44);

    // Derive key using passphrase and the extracted salt
    const key = crypto.scryptSync(passphrase, salt, 32);
    
    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    const memories = JSON.parse(decrypted);
    assert.strictEqual(memories.length, 2, 'Should decrypt exactly 2 memories');
    assert.ok(memories.some((m: any) => m.content === 'This is secure memory content 1'));
    assert.ok(memories.some((m: any) => m.content === 'A completely different memory content for the second item to bypass similarity checks'));
  });
});
