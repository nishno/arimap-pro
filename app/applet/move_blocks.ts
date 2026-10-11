import * as fs from 'fs';

const filePath = 'src/components/Harvesting/HarvestDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// The active protocol block starts with `<div className="bg-indigo-600 rounded-2xl p-4 shadow-lg text-white">`
// and ends with `</div>\n                        </div>\n                    </div>`

const apRegex = /<div className="bg-indigo-600 rounded-2xl p-4 shadow-lg text-white">[\s\S]*?{HARVEST_METHODS\.find\(m => m\.protocol === event\.protocol\)\?\.name \|\| 'Standard'\}<\/p>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>/;

const apMatch = content.match(apRegex);
if (!apMatch) {
    console.log("Could not find Active Protocol block");
    process.exit(1);
}
const apBlock = apMatch[0];

// Remove it from original
content = content.replace(apRegex, '');

// The Yield Visibility block starts with `<div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">\n                        <div className="flex flex-col gap-3 mb-3">`
// Wait. To be safer, the label is `<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('harvest.yield_visibility')}</label>`

const yvRegex = /<div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">\s*<div className="flex flex-col gap-3 mb-3">\s*<div className="flex justify-between items-center">\s*<label className="text-\[10px\] font-black text-slate-400 uppercase tracking-widest">\{t\('harvest\.yield_visibility'\)\}<\/label>[\s\S]*?(?:No varieties detected in sector<\/p>\s*<\/div>\s*\}\)\s*<\/div>\s*<\/div>|<div className="col-span-full py-8[\s\S]*?<\/div>\s*\)\}\s*<\/div>\s*<\/div>)/;

const yvMatch = content.match(yvRegex);
if (!yvMatch) {
    console.log("Could not find Yield Visibility block");
    process.exit(1);
}
const yvBlock = yvMatch[0];

// Remove it from original
content = content.replace(yvRegex, '');

// Now we insert Yield Visibility right after the HarvestLocalSyncPanel
// Look for `isLocalMode={true} \n                    />`
const hlspIndex = content.indexOf('isLocalMode={true} \n                    />');
const hlspEnd = content.indexOf('/>', hlspIndex) + 2;

content = content.slice(0, hlspEnd) + '\n\n                    ' + yvBlock + content.slice(hlspEnd);


// Now we insert Active Protocol after the Finish Job grid
// Look for `{t('harvest.resume_session_unlock')}\n                            </button>\n                        )}\n                    </div>`

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
