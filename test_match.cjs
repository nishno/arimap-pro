const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');
if (file.includes('displayTotalBoxes')) {
   console.log('Successfully replaced Total Containers');
} else {
   console.log('Failed to replace Total Containers');
}
