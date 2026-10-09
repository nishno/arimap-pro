const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(
    /import HarvestStatsGrid from '\.\/HarvestStatsGrid';/,
    `import { HarvestStatsGrid } from '../HarvestingStats';`
);
fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
