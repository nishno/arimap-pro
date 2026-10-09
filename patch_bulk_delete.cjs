const fs = require('fs');
let file = fs.readFileSync('src/components/HarvestingStats.tsx', 'utf8');

const target = `                    {/* Top Row: Add Worker, Export to Excel, Save Adjustments */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">`;

const replacement = `                    {/* Top Row: Add Worker, Export to Excel, Save Adjustments */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        {selectedPickers.size > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm(isKa ? \`ნამდვილად გსურთ არჩეული \${selectedPickers.size} მუშის წაშლა?\` : \`Are you sure you want to remove \${selectedPickers.size} selected workers?\`)) {
                                        const updated = localPickers.filter(p => !selectedPickers.has(p.employeeId));
                                        setLocalPickers(updated);
                                        syncPickersToParent(updated);
                                        setSelectedPickers(new Set());
                                    }
                                }}
                                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-2xl font-black text-xs tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs border border-red-200"
                            >
                                <TrashIcon className="h-4 w-4" /> {isKa ? \`წაშლა (\${selectedPickers.size})\` : \`Delete (\${selectedPickers.size})\`}
                            </button>
                        )}`;

file = file.replace(target, replacement);

fs.writeFileSync('src/components/HarvestingStats.tsx', file);
