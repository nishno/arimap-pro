const fs = require('fs');

const filePath = 'src/components/Harvesting/HarvestDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const apRegex = /<div className="bg-indigo-600 rounded-2xl p-4 shadow-lg text-white">[\s\S]*?\{HARVEST_METHODS\.find\(m => m\.protocol === event\.protocol\)\?\.name \|\| 'Standard'\}<\/p>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>/;

const apMatch = content.match(apRegex);
if (!apMatch) {
    console.log("Could not find Active Protocol block");
    process.exit(1);
}
const apBlock = apMatch[0];

content = content.replace(apRegex, '');

const yvRegex = /<div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">\s*<div className="flex flex-col gap-3 mb-3">\s*<div className="flex justify-between items-center">\s*<label className="text-\[10px\] font-black text-slate-400 uppercase tracking-widest">\{t\('harvest\.yield_visibility'\)\}<\/label>[\s\S]*?(?:No varieties detected in sector<\/p>\s*<\/div>\s*\}\)\s*<\/div>\s*<\/div>|<div className="col-span-full py-8[\s\S]*?<\/div>\s*\)\}\s*<\/div>\s*<\/div>)/;

const yvMatch = content.match(yvRegex);
if (!yvMatch) {
    console.log("Could not find Yield Visibility block");
    process.exit(1);
}
const yvBlock = yvMatch[0];

content = content.replace(yvRegex, '');

const hlspIndex = content.indexOf('isLocalMode={true} \n                    />');
const hlspEnd = content.indexOf('/>', hlspIndex) + 2;

content = content.slice(0, hlspEnd) + '\n\n                    ' + yvBlock + content.slice(hlspEnd);

const fvRegex = /\{t\('harvest\.resume_session_unlock'\)\}\n\s*<\/button>\n\s*\)\}\n\s*<\/div>/;
const fvMatch = content.match(fvRegex);
if (!fvMatch) {
    console.log("Could not find Finish Job grid block");
    process.exit(1);
}

const fvIndex = fvMatch.index + fvMatch[0].length;
content = content.slice(0, fvIndex) + '\n\n                    ' + apBlock + content.slice(fvIndex);

fs.writeFileSync(filePath, content);
console.log("Successfully moved blocks!");
