const fs = require('fs');
let file = fs.readFileSync('src/components/HarvestingStats.tsx', 'utf8');

const regex = /{selectedEmpId && \([\s\S]*?<\/span>\s*\)\s*}\s*<\/div>\s*{\/\* Worker Search Field \*\//;

const replacement = `{selectedEmpIds.length > 0 && (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                ✓ {isKa ? 'არჩეულია' : 'Selected'} ({selectedEmpIds.length})
                                            </span>
                                        )}
                                    </div>

                                    {/* Multi-select Tags */}
                                    {selectedEmpIds.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                            {selectedEmpIds.map(id => {
                                                const emp = employees.find(e => e.id === id);
                                                if (!emp) return null;
                                                return (
                                                    <div key={id} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-full text-[10px] font-bold text-slate-700 shadow-sm">
                                                        <div className="w-4 h-4 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <span className="truncate max-w-[100px]">{emp.name}</span>
                                                        <span className="text-slate-400 text-[8px] ml-1">ID: {emp.idNumber || emp.id.substring(0, 3)}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEmployeeSelectChange(id)}
                                                            className="ml-1 text-slate-400 hover:text-red-500 cursor-pointer p-0.5"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Worker Search Field */`;

if (regex.test(file)) {
    file = file.replace(regex, replacement);
    
    // Also replace `const isSelected = selectedEmpId === emp.id;`
    file = file.replace(/const isSelected = selectedEmpId === emp\.id;/g, "const isSelected = selectedEmpIds.includes(emp.id);");
    file = file.replace(/value={selectedEmpId}/g, "value={selectedEmpIds[0] || ''}");
    
    fs.writeFileSync('src/components/HarvestingStats.tsx', file);
    console.log('Patched UI block successfully via regex');
} else {
    console.error('Regex target block not found');
}
