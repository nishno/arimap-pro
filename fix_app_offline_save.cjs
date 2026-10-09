const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

// Inside handleSetHarvestEvents
file = file.replace(
    /if \(syncToCloud && USE_FIREBASE && auth\.currentUser && currentUser\?\.id !== 'root-system'\) \{/g,
    "if (syncToCloud && USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {"
);

// We need to add an `else` block to save to fb_cache if we are skipping Firebase
// But wait, there is already an `else { saveMockData('harvestEvents', ...); }`

