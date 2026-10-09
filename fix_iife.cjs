const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(
    /\{(?:(?:.|\n)*?)displayTotalBoxes\}\/\{displayTotalPunets\}\s*<\/span>\s*<\/>\s*\);\s*\}\)\(\)\}\s*<span className="text-xs font-bold text-slate-400 uppercase">Bxs\/Pnts<\/span>\s*<\/div>/,
    `                        {displayTotalBoxes}/{displayTotalPunets}
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase">Bxs/Pnts</span>
                </div>
            </>
        );
    })()}`
);

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
