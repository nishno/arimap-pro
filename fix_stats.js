const fs = require('fs');
let code = fs.readFileSync('src/components/HarvestingStats.tsx', 'utf8');

code = code.replace(/const rate = v\.isOwned \? \(machineDetails\?\.hourlyRate \|\| 0\) : v\.hiredCost;\s*return acc \+ \(\(v\.usageHours \|\| 0\) \* rate\);/g, `const rate = v.isOwned ? (machineDetails?.hourlyRate || 0) : v.hiredCost;
        const total = (v.usageHours || 0) > 0 ? (v.usageHours || 0) * rate : v.hiredCost;
        return acc + total;`);

fs.writeFileSync('src/components/HarvestingStats.tsx', code);
