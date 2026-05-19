import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ContextHubCore } from '@contexthub/core';
import { doctorCommand } from '../commands/doctor';

test('doctorCommand Smoke Test', async (t) => {
  const tempDir = path.resolve(__dirname, '../../../../temp-doctor-smoke-repo');
  const contexthubDir = path.join(tempDir, '.contexthub');

  // Setup healthy workspace
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(contexthubDir, { recursive: true });

  // Generate encryption key
  const keyfile = path.join(contexthubDir, '.keyfile');
  fs.writeFileSync(keyfile, crypto.randomBytes(32).toString('hex'));

  // Initialize storage and seed a memory to pass decryption test
  const core = new ContextHubCore(tempDir);
  await core.initStorage();
  const sessionId = await core.createSession('smoke-session', { source: 'doctor-smoke' });
  await core.saveMemory({
    sessionId,
    type: 'decision',
    content: 'Testing health status of the repo',
    timestamp: Date.now(),
    tags: ['smoke-test']
  });
  await core.endSession(sessionId);
  await core.close();

  // Change process CWD for command execution
  const originalCwd = process.cwd();
  process.chdir(tempDir);

  t.after(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('contexthub doctor executes cleanly and passes all health diagnostics', async () => {
    // Redirect console output to avoid polluting test logs
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    try {
      await doctorCommand();
      // If we got here without throwing/exiting, the check passed!
      const allLogs = logs.join('\n');
      assert.ok(allLogs.includes('All systems operational!'));
      assert.ok(allLogs.includes('ContextHub directory exists'));
      assert.ok(allLogs.includes('Keyfile exists'));
      assert.ok(allLogs.includes('Memories decrypt successfully'));
    } finally {
      console.log = originalLog;
    }
  });
});
