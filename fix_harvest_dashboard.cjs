const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

// 1. Fix Total Containers display (line ~2490)
const displayTotalBoxesStr = `const displayTotalBoxes = event.totalBoxes !== undefined ? event.totalBoxes : (filteredTotals?.totalBoxes || 0);
                            const displayTotalPunets = event.physicalPunets !== undefined ? event.physicalPunets : (calculatedPunetsFromEntries > 0 ? calculatedPunetsFromEntries : (displayTotalBoxes * (event?.punetsPerBox || 12)));`;

file = file.replace(
    /<p className="text-\[10px\] font-black uppercase tracking-widest text-blue-400 mb-1">\{t\('harvest.total_containers'\)\}<\/p>\s*<div className="flex items-baseline gap-1">\s*<span className="text-2xl sm:text-3xl font-black">\s*\{\(filteredTotals\?\.totalBoxes \|\| 0\)\}\/\{\(event\?\.totalPunets && event\.totalPunets >= \(filteredTotals\?\.totalBoxes \|\| 0\) \* 6\) \? event\.totalPunets : \(\(event\?\.physicalPunets && event\.physicalPunets >= \(filteredTotals\?\.totalBoxes \|\| 0\) \* 6\) \? event\.physicalPunets : \(calculatedPunetsFromEntries > 0 \? calculatedPunetsFromEntries : \(\(filteredTotals\?\.totalBoxes \|\| 0\) \* \(event\?\.punetsPerBox \|\| 12\)\)\)\)\}\s*<\/span>/,
    `{(() => {
        ${displayTotalBoxesStr}
        return (
            <>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">{t('harvest.total_containers')}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black">
                        {displayTotalBoxes}/{displayTotalPunets}
                    </span>
            </>
        );
    })()}`
);

// We should also replace the total boxes in the white card to use displayTotalBoxes
file = file.replace(
    /<span className="text-xl sm:text-2xl font-black text-slate-800">\{filteredTotals\.totalBoxes\}<\/span>\s*<span className="text-\[8px\] font-bold text-slate-400 uppercase">Boxes\/Punets<\/span>/,
    `<span className="text-xl sm:text-2xl font-black text-slate-800">{event.totalBoxes !== undefined ? event.totalBoxes : filteredTotals.totalBoxes}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Boxes/Punets</span>`
);

// Write back to see if these matched
fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
