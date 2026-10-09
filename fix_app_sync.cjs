const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(
    /if \(syncToCloud && USE_FIREBASE/g,
    "if (USE_FIREBASE"
);
// Now carefully add syncToCloud parameter to all set functions we need.
// 1. handleSetHarvestEvents
file = file.replace(
    /const handleSetHarvestEvents = async \(events: HarvestEvent\[\], syncToCloud = true\) => \{/,
    "const handleSetHarvestEvents = async (events: HarvestEvent[], syncToCloud = true) => {"
);
// Replace the specific IF statement inside handleSetHarvestEvents
const lines = file.split('\n');
let insideHarvestEvents = false;
let insideInventoryItems = false;
let insideEmployees = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleSetHarvestEvents = async (events: HarvestEvent[], syncToCloud = true) => {')) insideHarvestEvents = true;
    if (lines[i].includes('const handleSetInventoryItems = async (items: InventoryItem[]) => {')) {
        lines[i] = lines[i].replace('items: InventoryItem[]', 'items: InventoryItem[], syncToCloud = true');
        insideInventoryItems = true;
    }
    if (lines[i].includes('const handleSetEmployees = async (newEmployees: Employee[]) => {')) {
        lines[i] = lines[i].replace('newEmployees: Employee[]', 'newEmployees: Employee[], syncToCloud = true');
        insideEmployees = true;
    }
    
    // Once we hit the next function, reset flags
    if (lines[i].match(/const handleSet[A-Z]/) && !lines[i].includes('handleSetHarvestEvents') && !lines[i].includes('handleSetInventoryItems') && !lines[i].includes('handleSetEmployees')) {
        insideHarvestEvents = false;
        insideInventoryItems = false;
        insideEmployees = false;
    }
    
    if ((insideHarvestEvents || insideInventoryItems || insideEmployees) && lines[i].includes("if (USE_FIREBASE && auth.currentUser && currentUser?.id !== 'root-system') {")) {
        lines[i] = lines[i].replace("if (USE_FIREBASE", "if (syncToCloud && USE_FIREBASE");
    }
}
fs.writeFileSync('src/App.tsx', lines.join('\n'));
