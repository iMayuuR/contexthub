#!/usr/bin/env node
/**
 * ContextHub — Workspace Scope Renamer
 * 
 * This script allows you to easily rename all package scopes from '@contexthub/*' 
 * to your custom npm scope (e.g. '@imayuur/*' or '@imayuur/contexthub-*') so that you can
 * publish everything seamlessly under your personal npm account.
 * 
 * Usage:
 *   node scripts/rename-scope.js @imayuur
 *   # This will rename:
 *   #   @contexthub/core -> @imayuur/contexthub-core
 *   #   @contexthub/cli -> @imayuur/contexthub-cli
 *   #   ...and update all mutual dependencies accordingly!
 */

const fs = require('fs');
const path = require('path');

const targetScope = process.argv[2];

if (!targetScope) {
  console.error('\n❌ Please provide a target scope. Example:\n  node scripts/rename-scope.js @imayuur\n');
  process.exit(1);
}

if (!targetScope.startsWith('@')) {
  console.error('\n❌ NPM scopes must start with "@". Example: @imayuur\n');
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter(f => fs.statSync(path.join(packagesDir, f)).isDirectory());

console.log(`\n🔄 Renaming all ContextHub packages scope from '@contexthub' to '${targetScope}/contexthub'...\n`);

// 1. First, map all old package names to new package names
const nameMap = {};
for (const dir of packageDirs) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const oldName = pkg.name;
    const baseName = oldName.replace('@contexthub/', '');
    
    // Map '@contexthub/cli' directly to '@scope/contexthub' so they can run: npx @scope/contexthub
    const newName = baseName === 'cli' 
      ? `${targetScope}/contexthub` 
      : `${targetScope}/contexthub-${baseName}`;
      
    nameMap[oldName] = newName;
  }
}

// 2. Now, recursively update all package.json files
const allPackagePaths = [
  path.join(rootDir, 'package.json'),
  ...packageDirs.map(dir => path.join(packagesDir, dir, 'package.json'))
];

for (const pkgPath of allPackagePaths) {
  if (!fs.existsSync(pkgPath)) continue;

  const pkgContent = fs.readFileSync(pkgPath, 'utf8');
  let pkg = JSON.parse(pkgContent);
  const oldName = pkg.name;
  
  // Update name if mapped
  if (nameMap[oldName]) {
    console.log(`  🔹 ${oldName} ➔ ${nameMap[oldName]}`);
    pkg.name = nameMap[oldName];
  }

  // Update dependencies
  if (pkg.dependencies) {
    for (const [dep, ver] of Object.entries(pkg.dependencies)) {
      if (nameMap[dep]) {
        pkg.dependencies[nameMap[dep]] = ver;
        delete pkg.dependencies[dep];
      }
    }
  }

  // Update devDependencies
  if (pkg.devDependencies) {
    for (const [dep, ver] of Object.entries(pkg.devDependencies)) {
      if (nameMap[dep]) {
        pkg.devDependencies[nameMap[dep]] = ver;
        delete pkg.devDependencies[dep];
      }
    }
  }

  // Update peerDependencies
  if (pkg.peerDependencies) {
    for (const [dep, ver] of Object.entries(pkg.peerDependencies)) {
      if (nameMap[dep]) {
        pkg.peerDependencies[nameMap[dep]] = ver;
        delete pkg.peerDependencies[dep];
      }
    }
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

console.log(`\n✅ All workspaces successfully updated!`);
console.log(`\n👉 Next Steps to publish:`);
console.log(`  1. Run: npm login`);
console.log(`  2. Run: npm run publish:packages`);
console.log(`\n👉 Next Steps to install in projects:`);
console.log(`  npx ${targetScope}/contexthub setup\n`);
