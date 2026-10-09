const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(/calculatePickerEarnings } from '\.\.\/HarvestingStats';/, "calculatePickerEarnings, calculateTotalOpex } from '../HarvestingStats';");

const target = `                    unitCost: updatedEvent.saleDetails?.pricePerUnit || 0,
                    minStockThreshold: 0,`;

const replacement = `                    unitCost: (updatedEvent.saleDetails?.pricePerUnit || 0) > 0 ? (updatedEvent.saleDetails?.pricePerUnit || 0) : ((calculateTotalOpex(updatedEvent, currentEventEntries, calculateNetDurationHours(updatedEvent), machinery || []).totalCost) / (totalVarietyWeight || 1)),
                    minStockThreshold: 0,`;

file = file.replace(target, replacement);

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
