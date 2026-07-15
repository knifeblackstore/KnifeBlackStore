const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

files.forEach(f => {
    let html = fs.readFileSync(f, 'utf8');
    if (!html.includes('<link rel="icon"')) {
        html = html.replace('</head>', '    <link rel="icon" href="data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 100 100\\"><text y=\\".9em\\" font-size=\\"90\\">🔪</text></svg>">\n</head>');
        fs.writeFileSync(f, html, 'utf8');
    }
});
console.log('Favicons added');
