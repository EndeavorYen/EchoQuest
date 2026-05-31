const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');
const srcHtml = path.join(publicDir, 'index.html');
const destHtml = path.join(distDir, 'index.html');
const srcAssets = path.join(publicDir, 'assets');
const destAssets = path.join(distDir, 'assets');

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy index.html
fs.copyFileSync(srcHtml, destHtml);
copyDirectory(srcAssets, destAssets);

console.log('Copied public assets to dist');
