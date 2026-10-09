const fs = require('fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const lines = app.split('\n');
console.log(lines.find(l => l.includes('const handleSetHarvestEvents')));
console.log(lines.find(l => l.includes('const handleSetInventoryItems')));
console.log(lines.find(l => l.includes('const handleSetEmployees')));
