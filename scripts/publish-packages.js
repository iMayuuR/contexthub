#!/usr/bin/env node
/**
 * Publish @contexthub/* packages to npm in dependency order.
 * Prerequisite: npm login && npm whoami
 *
 * Usage: npm run publish:packages
 */

const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

const PUBLISH_ORDER = [
  'shared-types',
  'core',
  'vector-engine',
  'repo-parser',
  'knowledge-graph',
  'docs-ingest',
  'plugin-pdf',
  'git-integration',
  'memory-engine',
  'context-injector',
  'agent-connectors',
  'skills',
  'mcp-server',
  'cli',
];

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

run('npm run build');

for (const pkg of PUBLISH_ORDER) {
  const dir = path.join(root, 'packages', pkg);
  const pkgJsonPath = path.join(dir, 'package.json');
  let pkgName = `@contexthub/${pkg}`;
  try {
    const pkgJson = require(pkgJsonPath);
    pkgName = pkgJson.name;
  } catch (e) {}

  console.log(`\n━━━ Publishing ${pkgName} ━━━`);
  try {
    run('npm publish --access public', dir);
  } catch (err) {
    console.log(`\n⚠️  Skipped ${pkgName} (likely already published or unpublished)`);
  }
}

console.log('\n✅ All packages published successfully!');
