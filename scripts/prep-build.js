// Stages the icon electron-builder uses, so the build always has a valid
// ≥256px icon regardless of whether the user dropped their own. Copies the
// preferred icon (assets/icon.png if present, else the generated default) to
// build/icon.png, which electron-builder's win.icon points at.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const assets = path.join(root, 'assets');
const buildDir = path.join(root, 'build');

const user = path.join(assets, 'icon.png');
const fallback = path.join(assets, 'icon.default.png');
const src = fs.existsSync(user) ? user : fallback;

if (!fs.existsSync(src)) {
  console.error('No icon found. Run `npm run gen-icon` first.');
  process.exit(1);
}

fs.mkdirSync(buildDir, { recursive: true });
fs.copyFileSync(src, path.join(buildDir, 'icon.png'));
console.log('build/icon.png <-', path.relative(root, src));
