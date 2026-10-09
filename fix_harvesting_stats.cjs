const fs = require('fs');
let file = fs.readFileSync('src/components/HarvestingStats.tsx', 'utf8');

const lines = file.split('\n');
let insideHandleSave = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleSave = (syncToCloud = true) => {')) insideHandleSave = true;
    
    // Once we exit handleSave
    if (insideHandleSave && lines[i].includes('const filteredPickers = useMemo(() => {')) insideHandleSave = false;
    
    // Fix the accidental replacements BEFORE handleSave
    if (!insideHandleSave && lines[i].includes('syncToCloud')) {
        // Leave the toast.success or the function declarations intact, just fix the function calls
        if (lines[i].includes('onSetHarvestEvents(') && lines[i].includes(', syncToCloud)')) {
            lines[i] = lines[i].replace(', syncToCloud', '');
        }
        if (lines[i].includes('onSetInventoryItems as any') && lines[i].includes(', syncToCloud)')) {
            lines[i] = lines[i].replace('(onSetInventoryItems as any)(updatedInv, syncToCloud)', 'onSetInventoryItems(updatedInv)');
        }
        if (lines[i].includes('onSetEmployees as any') && lines[i].includes(', syncToCloud)')) {
            lines[i] = lines[i].replace('(onSetEmployees as any)(updatedEmployees, syncToCloud)', 'onSetEmployees(updatedEmployees)');
        }
    }
    
    // Fix the actual function calls INSIDE handleSave
    if (insideHandleSave) {
        if (lines[i].includes('onSetHarvestEvents(') && !lines[i].includes('syncToCloud')) {
            lines[i] = lines[i].replace(');', ', syncToCloud);');
        }
        if (lines[i].includes('onSetInventoryItems(') && !lines[i].includes('syncToCloud')) {
            lines[i] = lines[i].replace('onSetInventoryItems(updatedInv);', 'onSetInventoryItems(updatedInv, syncToCloud);');
        }
        if (lines[i].includes('onSetEmployees(') && !lines[i].includes('syncToCloud')) {
            lines[i] = lines[i].replace('onSetEmployees(updatedEmployees);', 'onSetEmployees(updatedEmployees, syncToCloud);');
        }
    }
}
fs.writeFileSync('src/components/HarvestingStats.tsx', lines.join('\n'));
