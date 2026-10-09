const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(
    /const handleSetHarvestEvents = async \(events: HarvestEvent\[\]\) => \{/,
    "const handleSetHarvestEvents = async (events: HarvestEvent[], syncToCloud = true) => {"
);
file = file.replace(
    /if \(USE_FIREBASE && auth\.currentUser && currentUser\?\.id !== 'root-system'\) \{/g,
    "if (syncToCloud && USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {"
);

fs.writeFileSync('src/App.tsx', file);
