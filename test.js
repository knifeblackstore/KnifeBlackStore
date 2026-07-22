const fs = require('fs');
const lines = fs.readFileSync('script.js', 'utf8').split('\n');
lines.forEach((l, i) => { 
    if(l.includes("db.ref('grids")) console.log(i + ': ' + l.trim()); 
});
