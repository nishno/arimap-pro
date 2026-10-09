const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(
    /                    \/>\n                        <\/>\n                    \)}\n                <\/div>\n            <\/div>/,
    `                    />
                </div>
            </div>`
);
fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
