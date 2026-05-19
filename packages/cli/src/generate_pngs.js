const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const brandingDir = path.join(process.cwd(), 'docs', 'assets', 'branding');
const assetsDir = path.join(process.cwd(), 'docs', 'assets');

async function convert(srcName, destName, width, height, destDir = brandingDir) {
  try {
    const srcPath = path.join(brandingDir, srcName);
    const destPath = path.join(destDir, destName);

    if (!fs.existsSync(srcPath)) {
      console.error(`Source not found: ${srcPath}`);
      return;
    }

    await sharp(srcPath)
      .resize(width, height)
      .png()
      .toFile(destPath);

    console.log(`✅ Converted ${srcName} -> ${destName} (${width}x${height})`);
  } catch (err) {
    console.error(`❌ Error converting ${srcName}:`, err.message);
  }
}

async function run() {
  // Ensure branding folder exists
  fs.mkdirSync(brandingDir, { recursive: true });

  // Convert files
  await convert('icon.svg', 'icon.png', 512, 512);
  await convert('logo.svg', 'logo.png', 640, 80, assetsDir);
  await convert('favicon.svg', 'favicon.png', 32, 32, assetsDir);
  await convert('favicon.svg', 'favicon.png', 32, 32);

  // Favicon.ico copy from favicon.png for legacy support
  try {
    const pngPath = path.join(assetsDir, 'favicon.png');
    const icoPath = path.join(assetsDir, 'favicon.ico');
    fs.copyFileSync(pngPath, icoPath);
    console.log(`✅ Copied favicon.png -> favicon.ico`);
  } catch (err) {
    console.error('❌ Error copying favicon.ico:', err.message);
  }
}

run();
