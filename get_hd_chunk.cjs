const fs = require('fs');
const bundleContent = fs.readFileSync('dist/assets/index-DC7ywZJG.js', 'utf8');
const pos = 3216054;
const start = Math.max(0, pos - 5000);
const end = Math.min(bundleContent.length, pos + 5000);
fs.writeFileSync('/tmp/Bxs_Pnts_chunk.js', bundleContent.slice(start, end));
