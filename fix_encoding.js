// fix_encoding.js
// Scan project files (*.html, *.css, *.js) and replace common garbled UTF-8 sequences with correct characters.
// Also fixes the broken menu link in apps.html.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname);

// Mapping of broken sequences to correct characters
const map = {
  'ñ': 'ñ',
  'á': 'á',
  'é': 'é',
  'í': 'í',
  'ó': 'ó',
  'ú': 'ú',
  '¿': '¿',
  '¡': '¡',
  '➔': '➔',
  '→': '→',
  '–': '–',
  '—': '—',
  '…': '…',
  '“': '“',
  '”': '”',
  '‘': '‘',
  '’': '’',
  '•': '•',
  'ü': 'ü',
  'ç': 'ç',
  'Ñ': 'Ñ',
  'õ': 'õ'
};

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [bad, good] of Object.entries(map)) {
    if (content.includes(bad)) {
      content = content.split(bad).join(good);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed ${filePath}`);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (['node_modules', '.git', '.github', '.firebase'].includes(entry.name)) continue;
      walk(fullPath);
    } else if (entry.isFile()) {
      if (/\.(html|css|js)$/i.test(entry.name)) {
        replaceInFile(fullPath);
      }
    }
  }
}

// Run replacement across the whole project
walk(root);

// Specific fix for the broken link in apps.html
const appsPath = path.join(root, 'apps.html');
if (fs.existsSync(appsPath)) {
  let appsContent = fs.readFileSync(appsPath, 'utf8');
  const fixed = appsContent.replace(/Servicios ➔/g, 'Servicios ➔');
  if (fixed !== appsContent) {
    fs.writeFileSync(appsPath, fixed, 'utf8');
    console.log('Fixed services link in apps.html');
  }
}

console.log('Encoding fix completed.');
