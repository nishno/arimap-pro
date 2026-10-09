const fs = require('fs');
const lines = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8').split('\n');
let inside = false;
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('const HarvestLocalSyncPanel: React.FC')) inside = true;
  if (inside) console.log(lines[i]);
  if (inside && lines[i].includes('return (')) {
     inside = false;
  }
}
