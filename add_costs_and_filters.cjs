const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

// I will insert it after the other costs section.
const marker = `{/* Packaging & Punet Quantities (Sync to Stock) */}`;

if (!file.includes(marker)) {
    console.log("Marker not found!");
} else {
    console.log("Marker found!");
}
