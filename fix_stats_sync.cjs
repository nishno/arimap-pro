const fs = require('fs');
let file = fs.readFileSync('src/components/HarvestingStats.tsx', 'utf8');

file = file.replace(/onSetHarvestEvents\(\(harvestEvents \|\| \[\]\)\.map\(e => e\.id === event\.id \? updatedEvent : e\), syncToCloud\);/g, 
"onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));");

file = file.replace(/\(onSetInventoryItems as any\)\(updatedInv, syncToCloud\);/g, 
"(onSetInventoryItems as any)(updatedInv);");

file = file.replace(/\(onSetEmployees as any\)\(updatedEmployees, syncToCloud\);/g, 
"(onSetEmployees as any)(updatedEmployees);");

fs.writeFileSync('src/components/HarvestingStats.tsx', file);
