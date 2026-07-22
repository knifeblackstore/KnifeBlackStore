const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf8');

const map = {
    '­ƒÄ¼': '🎮',
    '­ƒÅ«': '📌',
    '­ƒÄÄ': '👾',
    '­ƒÄÆ': '💍',
    '­ƒôè': '📦',
    '­ƒôª': '📋',
    '­ƒôÑ': '📊',
    '­ƒº¥': '📜',
    '­ƒÆ¼': '💬',
    '­ƒû¿´©Å': '🧾',
    '­ƒôü': '📤',
    '­ƒöù': '🔗'
};

for (const [bad, good] of Object.entries(map)) {
    js = js.split(bad).join(good);
}

fs.writeFileSync('script.js', js, 'utf8');
console.log('Fixed rest of emojis.');
