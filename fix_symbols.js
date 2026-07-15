const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf8');

const map = {
    '¡├ëxito!': '¡Éxito!',
    'DIN├üMICO': 'DINÁMICO',
    'ART├ìCULOS': 'ARTÍCULOS',
    'DESPU├ëS': 'DESPUÉS',
    'ÔÜá´©Å': '⚠️',
    '¡A├æADIDO!': '¡AÑADIDO!',
    '├®xito': 'éxito',
    'Tambi├®n': 'También',
    'Ô¼à': '⬅️',
    'ÔØî': '❌',
    'GALER├ìA': 'GALERÍA',
    'IM├üGENES': 'IMÁGENES',
    'M├ÜLTIPLES': 'MÚLTIPLES',
    'ÔùÇ': '◀',
    'ÔûÂ': '▶'
};

for (const [bad, good] of Object.entries(map)) {
    js = js.split(bad).join(good);
}

fs.writeFileSync('script.js', js, 'utf8');
console.log('Fixed more emojis/accents.');
