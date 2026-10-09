const fs = require('fs');
const bundleContent = fs.readFileSync('dist/assets/index-DC7ywZJG.js', 'utf8');
const startPos = 3195000;
const endPos = 3280000;
fs.writeFileSync('/tmp/HarvestDashboard_decompiled.js', bundleContent.slice(startPos, endPos));
console.log(`Saved chunk from ${startPos} to ${endPos}`);
