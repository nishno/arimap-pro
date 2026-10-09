const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(
    /unitCost: \(updatedEvent\.saleDetails\?\.pricePerUnit \|\| 0\) > 0 \? \(updatedEvent\.saleDetails\?\.pricePerUnit \|\| 0\) : \(\(calculateTotalOpex\(updatedEvent, currentEventEntries, calculateNetDurationHours\(updatedEvent\), machinery \|\| \[\]\)\.totalCost\) \/ \(totalVarietyWeight \|\| 1\)\),/,
    "unitCost: (calculateTotalOpex(updatedEvent, currentEventEntries, calculateNetDurationHours(updatedEvent), machinery || []).totalCost) / (totalVarietyWeight || 1),"
);

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
