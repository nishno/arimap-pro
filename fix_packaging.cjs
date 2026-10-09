const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(
    /placeholder=\{String\(filteredTotals\.totalBoxes \|\| 0\)\}/g,
    `placeholder={String(event.totalBoxes !== undefined ? event.totalBoxes : (filteredTotals.totalBoxes || 0))}`
);

// We need to change the "Sync New Quantities" button to also update `event.totalBoxes` and `event.physicalPunets`.
const syncBtnTarget = /const currentItems = event\.materialsUsed \|\| \[\];/;
const syncBtnReplacement = `const currentItems = event.materialsUsed || [];
                                                    const updatedEventBase = { 
                                                        ...event, 
                                                        totalBoxes: bQty > 0 ? bQty : event.totalBoxes, 
                                                        physicalPunets: pQty > 0 ? pQty : event.physicalPunets 
                                                    };`;

file = file.replace(syncBtnTarget, syncBtnReplacement);
file = file.replace(
    /const updatedEvent = \{ \.\.\.event, materialsUsed: updatedItems \};/,
    `const updatedEvent = { ...updatedEventBase, materialsUsed: updatedItems };`
);

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
