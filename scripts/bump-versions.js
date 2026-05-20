const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');
const TARGET_VERSION = '1.0.1';

// Get all directories inside /packages
const packages = fs.readdirSync(packagesDir).filter(name => {
  return fs.statSync(path.join(packagesDir, name)).isDirectory();
});

console.log(`Bumping all packages to version: ${TARGET_VERSION}...`);

for (const pkg of packages) {
  const pkgJsonPath = path.join(packagesDir, pkg, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;

  const content = fs.readFileSync(pkgJsonPath, 'utf8');
  const pkgJson = JSON.parse(content);

  // Update own version
  const oldVersion = pkgJson.version;
  pkgJson.version = TARGET_VERSION;

  // Update dependencies starting with @imayuur/contexthub
  const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies'];
  for (const depType of dependencyTypes) {
    if (pkgJson[depType]) {
      for (const [depName, depVer] of Object.entries(pkgJson[depType])) {
        if (depName.startsWith('@imayuur/contexthub')) {
          pkgJson[depType][depName] = `^${TARGET_VERSION}`;
        }
      }
    }
  }

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
  console.log(`✅ Bumped ${pkgJson.name}: ${oldVersion} -> ${TARGET_VERSION}`);
}

console.log('\n🎉 Version bump completed successfully!');
