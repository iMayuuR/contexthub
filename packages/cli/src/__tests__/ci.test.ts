import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { SecurityManager } from '@imayuur/contexthub-core';
import { ciCommand } from '../commands/ci';
import { blastRadiusCommand } from '../commands/blast-radius';

describe('CI & Blast-Radius Commands', () => {
  const tempRepoDir = path.resolve(process.cwd(), 'temp-test-ci-repo');
  let originalCwd: () => string;

  before(() => {
    if (!fs.existsSync(tempRepoDir)) {
      fs.mkdirSync(tempRepoDir, { recursive: true });
    }
    
    // Set up mock .contexthub and keyfile
    const contexthubDir = path.join(tempRepoDir, '.contexthub');
    fs.mkdirSync(contexthubDir, { recursive: true });
    
    // Create keyfile
    const keyfile = path.join(contexthubDir, '.keyfile');
    const crypto = require('crypto');
    fs.writeFileSync(keyfile, crypto.randomBytes(32).toString('hex'));

    // Create a mock code file to parse
    const srcDir = path.join(tempRepoDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'a.ts'), 'export function a() {}');
    
    originalCwd = process.cwd;
    process.cwd = () => tempRepoDir;
  });

  after(() => {
    process.cwd = originalCwd;
    if (fs.existsSync(tempRepoDir)) {
      fs.rmSync(tempRepoDir, { recursive: true, force: true });
    }
  });

  test('ciCommand executes successfully and writes report', async () => {
    // Set process.env.GITHUB_STEP_SUMMARY to mock file
    const mockStepSummary = path.join(tempRepoDir, 'step-summary.md');
    process.env.GITHUB_STEP_SUMMARY = mockStepSummary;

    await ciCommand();

    // Verify report was written
    const reportPath = path.join(tempRepoDir, '.contexthub', 'GRAPH_REPORT.md');
    assert.strictEqual(fs.existsSync(reportPath), true);

    // Verify step summary was written
    assert.strictEqual(fs.existsSync(mockStepSummary), true);
    const summaryContent = fs.readFileSync(mockStepSummary, 'utf8');
    assert.match(summaryContent, /ContextHub Graph Report/);

    delete process.env.GITHUB_STEP_SUMMARY;
  });

  test('blastRadiusCommand prints Markdown report', async () => {
    let output = '';
    const originalLog = console.log;
    console.log = (msg: string) => {
      output += msg + '\n';
    };

    try {
      await blastRadiusCommand(['src/a.ts']);
    } finally {
      console.log = originalLog;
    }

    assert.match(output, /ContextHub PR Blast-Radius Report/);
    assert.match(output, /src\/a.ts/);
  });
});
