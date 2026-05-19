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

  await t.test('parses Ruby fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'ruby', 'sample.rb');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed);
    assert.strictEqual(parsed.language, 'ruby');
    assert.ok(parsed.symbols.some(s => s.name === 'SampleRuby' && s.type === 'class'));
    assert.ok(parsed.symbols.some(s => s.name === 'greet' && s.type === 'function'));
    assert.ok(parsed.imports.some(i => i.source === 'json'));
  });

  await t.test('parses PHP fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'php', 'sample.php');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed);
    assert.strictEqual(parsed.language, 'php');
    assert.ok(parsed.symbols.some(s => s.name === 'SamplePhp' && s.type === 'class'));
    assert.ok(parsed.symbols.some(s => s.name === 'handleRequest' && s.type === 'function'));
    assert.ok(parsed.imports.some(i => i.source === 'Symfony\\Component\\HttpFoundation\\Request'));
  });

  await t.test('parses C# fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'csharp', 'sample.cs');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed);
    assert.strictEqual(parsed.language, 'csharp');
    assert.ok(parsed.symbols.some(s => s.name === 'SampleCSharp' && s.type === 'class'));
    assert.ok(parsed.symbols.some(s => s.name === 'ExecuteAction' && s.type === 'method'));
    assert.ok(parsed.imports.some(i => i.source === 'System'));
  });

  await t.test('parses Swift fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'swift', 'sample.swift');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed);
    assert.strictEqual(parsed.language, 'swift');
    assert.ok(parsed.symbols.some(s => s.name === 'SampleSwift' && s.type === 'class'));
    assert.ok(parsed.symbols.some(s => s.name === 'performOperation' && s.type === 'function'));
    assert.ok(parsed.imports.some(i => i.source === 'UIKit'));
  });

  await t.test('parses Kotlin fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'kotlin', 'sample.kt');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed);
    assert.strictEqual(parsed.language, 'kotlin');
    assert.ok(parsed.symbols.some(s => s.name === 'SampleKotlin' && s.type === 'class'));
    assert.ok(parsed.symbols.some(s => s.name === 'calculateMax' && s.type === 'function'));
    assert.ok(parsed.imports.some(i => i.source === 'kotlin.math.max'));
  });

  await t.test('parses Scala fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'scala', 'sample.scala');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed);
    assert.strictEqual(parsed.language, 'scala');
    assert.ok(parsed.symbols.some(s => s.name === 'SampleScala' && s.type === 'class'));
    assert.ok(parsed.symbols.some(s => s.name === 'processItems' && s.type === 'function'));
    assert.ok(parsed.imports.some(i => i.source === 'scala.collection.mutable.ListBuffer'));
  });

  await t.test('parses CPP fixture correctly', async () => {
    const filePath = path.join(fixturesDir, 'cpp', 'sample.cpp');
    const parsed = await repoParser.parseFile(filePath);
    
    assert.ok(parsed);
    assert.strictEqual(parsed.language, 'cpp');
    assert.ok(parsed.symbols.some(s => s.name === 'SampleCPP' && s.type === 'class'));
    assert.ok(parsed.symbols.some(s => s.name === 'printHello' && s.type === 'function'));
    assert.ok(parsed.imports.some(i => i.source === 'iostream'));
  });
});
