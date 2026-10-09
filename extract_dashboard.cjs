const fs = require('fs');
const bundlePath = 'dist/assets/index-DC7ywZJG.js';
if (fs.existsSync(bundlePath)) {
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    const startPos = 3165000;
    const endPos = 3195000;
    fs.writeFileSync('/tmp/HarvestDashboard_decompiled.js', bundleContent.slice(startPos, endPos));
    console.log(`Saved chunk from ${startPos} to ${endPos}`);
}
