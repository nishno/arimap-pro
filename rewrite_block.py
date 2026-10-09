import re

with open('src/components/HarvestingStats.tsx', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'className="flex gap-2 items-center justify-between mt-2 pt-2 border-t border-slate-100"' in line:
        start_idx = i - 1
    if '{physicalHalfBoxes > 0 && (' in line and start_idx != -1 and i > start_idx + 10:
        if end_idx == -1 or 'className="text-[9px] font-extrabold p-1.5' in lines[i+1]:
            end_idx = i

if start_idx != -1 and end_idx != -1:
    new_content = """                                    
                                    <div className="flex gap-2 items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                        {/* Merge 2 Half Boxes Action Button */}
                                        {physicalHalfBoxes >= 2 ? (
                                            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-1.5 w-full">
                                                <span className="text-[9px] font-black leading-tight">
                                                    💡 {isKa ? '2 ნახევარი (6/6) = 1 სრული (12)' : '2 Half (6/6) = 1 Full (12)'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newFull = physicalBoxes + 1;
                                                        const newHalf = Math.max(0, physicalHalfBoxes - 2);
                                                        setPhysicalBoxes(newFull);
                                                        setPhysicalHalfBoxes(newHalf);
                                                        syncPickersToParent(localPickers, { totalBoxes: newFull, physicalHalfBoxes: newHalf });
                                                        toast.success(isKa ? '2 ნახევარი ყუთი გაერთიანდა 1 სრულ ყუთად!' : 'Merged 2 half boxes into 1 full box!');
                                                    }}
                                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-black text-[8px] uppercase tracking-wider shrink-0 cursor-pointer shadow-2xs"
                                                >
                                                    {isKa ? '🔗 გაერთიანება' : '🔗 Merge to 1 Box'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex-grow"></div>
                                        )}
                                        
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const pnts = Math.round((physicalBoxes + (physicalHalfBoxes * 0.5)) * punetsPerBox);
                                                setPhysicalPunets(pnts);
                                                setIsPunetsManuallyEdited(false);
                                                syncPickersToParent(localPickers, { physicalPunets: pnts, punetsPerBox });
                                                
                                                if (inventoryItems && onSetInventoryItems) {
                                                    const updatedInv = inventoryItems.map(item => {
                                                        if (item.relatedHarvestId === event.id && item.category === 'Produce') {
                                                            return { ...item, physicalBoxes, physicalPunnets: pnts };
                                                        }
                                                        return item;
                                                    });
                                                    onSetInventoryItems(updatedInv);
                                                }
                                                toast.success(isKa ? 'რაოდენობები განახლდა!' : 'Quantities updated successfully!');
                                            }}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-[10px] uppercase tracking-wider shadow-sm cursor-pointer whitespace-nowrap"
                                        >
                                            {isKa ? 'განახლება' : 'Update Quantities'}
                                        </button>
                                    </div>
"""
    lines = lines[:start_idx] + [new_content] + lines[end_idx:]
    with open('src/components/HarvestingStats.tsx', 'w') as f:
        f.writelines(lines)
    print(f"Replaced {start_idx} to {end_idx}")
else:
    print("Not found", start_idx, end_idx)
