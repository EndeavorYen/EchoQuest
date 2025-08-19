const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const publicDir = __dirname; // In our case, public/index.html is at the same level as this script. Let's adjust if needed.
const srcHtml = path.join(publicDir, 'public', 'index.html');
const destHtml = path.join(distDir, 'index.html');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy index.html
fs.copyFileSync(srcHtml, destHtml);

console.log('Copied index.html to dist/index.html');
