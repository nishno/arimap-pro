const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(
    /    \}\)\(\)\}\n                        <\/div>\n                    <\/div>\n\n                    <HarvestStatsGrid/,
    `    })()}
                        </div>
                    <HarvestStatsGrid`
);
fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
