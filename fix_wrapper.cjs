const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(
    /\{\(\(\) => \{\n                        \{displayTotalBoxes\}\/\{displayTotalPunets\}\n                    <\/span>/,
    `{(() => {
        return (
            <>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">{t('harvest.total_containers') || 'Total Containers'}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black">
                        {displayTotalBoxes}/{displayTotalPunets}
                    </span>`
);
fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
