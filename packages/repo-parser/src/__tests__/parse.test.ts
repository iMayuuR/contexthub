import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { RepoParser } from '../index';

test('RepoParser', async (t) => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures');
  const repoParser = new RepoParser(fixturesDir);

  await t.test('parses TypeScript fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'typescript', 'sample.ts');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed, 'should parse without throwing');
    assert.strictEqual(parsed!.language, 'typescript');
    assert.ok(parsed!.symbols.length >= 1, 'should have at least 1 symbol');
    assert.ok(parsed!.exports.length >= 1, 'should have at least 1 export');
  });

  await t.test('parses Python fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'python', 'sample.py');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed, 'should parse without throwing');
    assert.strictEqual(parsed!.language, 'python');
    assert.ok(parsed!.symbols.length >= 1, 'should have at least 1 symbol');
    assert.ok(parsed!.exports.length >= 1, 'should have at least 1 export');
  });

  await t.test('parses Go fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'go', 'sample.go');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed, 'should parse without throwing');
    assert.strictEqual(parsed!.language, 'go');
    assert.ok(parsed!.symbols.length >= 1, 'should have at least 1 symbol');
  });

  await t.test('parses Rust fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'rust', 'sample.rs');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed, 'should parse without throwing');
    assert.strictEqual(parsed!.language, 'rust');
    assert.ok(parsed!.symbols.length >= 1, 'should have at least 1 symbol');
  });

  await t.test('parses Java fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'java', 'sample.java');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed, 'should parse without throwing');
    assert.strictEqual(parsed!.language, 'java');
    assert.ok(parsed!.symbols.length >= 1, 'should have at least 1 symbol');
    // Java parser doesn't currently implement strict `exports` field natively, but we test that it parses.
    // We check for >= 1 symbols
  });
});
