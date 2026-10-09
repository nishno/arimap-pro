const fs = require('fs');
const bundleContent = fs.readFileSync('dist/assets/index-DC7ywZJG.js', 'utf8');

const positions = [3175028, 3187903];
for (const pos of positions) {
    const start = Math.max(0, pos - 150);
    const end = Math.min(bundleContent.length, pos + 150);
    console.log(`\n--- Match at ${pos} ---`);
    console.log(bundleContent.slice(start, end));
}
