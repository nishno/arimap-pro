const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(
    /placeholder=\{String\(filteredTotals\.totalBoxes \|\| 0\)\}/g,
    `placeholder={String(event.totalBoxes !== undefined ? event.totalBoxes : (filteredTotals.totalBoxes || 0))}`
);

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
