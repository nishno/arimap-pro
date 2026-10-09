const fs = require('fs');
const bundleContent = fs.readFileSync('dist/assets/index-DC7ywZJG.js', 'utf8');

// The component is likely defined like: const HarvestDashboard = (e) => { ... } or function HarvestDashboard(e) { ... }
let pos = bundleContent.indexOf('HarvestDashboard');
while(pos !== -1) {
    const start = Math.max(0, pos - 50);
    const end = Math.min(bundleContent.length, pos + 50);
    console.log(`\n--- Match at ${pos} ---`);
    console.log(bundleContent.slice(start, end));
    pos = bundleContent.indexOf('HarvestDashboard', pos + 1);
}
