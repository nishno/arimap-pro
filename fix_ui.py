import re

with open('src/components/Harvesting/HarvestDashboard.tsx', 'r') as f:
    content = f.read()

def get_replacement():
    return """                        {/* Packaging & Punet Quantities (Sync to Stock) */}
                        <div className="pt-2 border-t border-slate-200">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-[8px] font-black text-amber-900 uppercase tracking-widest block flex items-center gap-1">
                                    <span>🍓</span> {t('language') === 'ka' ? 'შეფუთვის და პუნეტების რაოდენობები' : 'Packaging & Punet OPEX Settings'}
                                </label>
                                <span className="text-[8px] font-black text-slate-400">SYNC TO STOCK</span>
                            </div>
                            
                            {(() => {
                                const punetItem = inventoryItems.find(i => i.name.toLowerCase().includes('punet') || i.name.toLowerCase().includes('პუნეტი'));
                                const boxItem = inventoryItems.find(i => i.name.toLowerCase().includes('box') || i.name.toLowerCase().includes('ყუთი') || i.category === 'Packaging');
                                const currentSyncedBoxes = event.materialsUsed?.find(m => m.inventoryItemId === boxItem?.id)?.quantity || 0;
                                const currentSyncedPunets = event.materialsUsed?.find(m => m.inventoryItemId === punetItem?.id)?.quantity || 0;
                                
                                return (
                                    <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100 space-y-2">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[8px] font-bold text-amber-900 uppercase block mb-1">
                                                    {t('language') === 'ka' ? 'ყუთების რაოდენობა' : 'Box Quantity'}
                                                </label>
                                                <input 
                                                    type="number" 
                                                    value={pkgBoxQty}
                                                    onChange={e => {
                                                        const b = e.target.value;
                                                        setPkgBoxQty(b);
                                                        if (b && pkgPunetsPerBox) {
                                                            setPkgPunetQty(String(Math.round(parseFloat(b) * parseFloat(pkgPunetsPerBox))));
                                                        }
                                                    }}
                                                    placeholder={String(filteredTotals.totalBoxes || 0)}
                                                    className="w-full p-1.5 bg-white border border-amber-200 rounded text-[10px] font-bold outline-none focus:border-amber-400"
                                                />
                                                <div className="text-[8px] text-amber-700 mt-0.5 font-bold">
                                                    {t('language') === 'ka' ? 'უკვე ჩამოწერილი:' : 'Already synced:'} {currentSyncedBoxes}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-bold text-amber-900 uppercase block mb-1">
                                                    {t('language') === 'ka' ? 'პუნეტების რაოდენობა' : 'Punet Quantity'}
                                                </label>
                                                <input 
                                                    type="number" 
                                                    value={pkgPunetQty}
                                                    onChange={e => setPkgPunetQty(e.target.value)}
                                                    placeholder={String(Math.round((filteredTotals.totalBoxes || 0) * parseFloat(pkgPunetsPerBox || "12")))}
                                                    className="w-full p-1.5 bg-white border border-amber-200 rounded text-[10px] font-bold outline-none focus:border-amber-400"
                                                />
                                                <div className="text-[8px] text-amber-700 mt-0.5 font-bold">
                                                    {t('language') === 'ka' ? 'უკვე ჩამოწერილი:' : 'Already synced:'} {currentSyncedPunets}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-bold text-amber-900 uppercase block mb-1">
                                                    {t('language') === 'ka' ? 'პუნეტები ყუთში' : 'Punets / Box'}
                                                </label>
                                                <input 
                                                    type="number" 
                                                    value={pkgPunetsPerBox}
                                                    onChange={e => {
                                                        const pb = e.target.value;
                                                        setPkgPunetsPerBox(pb);
                                                        if (pkgBoxQty && pb) {
                                                            setPkgPunetQty(String(Math.round(parseFloat(pkgBoxQty) * parseFloat(pb))));
                                                        }
                                                    }}
                                                    className="w-full p-1.5 bg-white border border-amber-200 rounded text-[10px] font-bold outline-none focus:border-amber-400"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const oldMaterials = event.materialsUsed || [];
                                                    const newMaterials = oldMaterials.map(m => ({...m}));
                                                    
                                                    const finalBoxQty = parseFloat(pkgBoxQty) || filteredTotals.totalBoxes || 0;
                                                    const finalPunetQty = parseFloat(pkgPunetQty) || Math.round(finalBoxQty * parseFloat(pkgPunetsPerBox || "12"));
                                                    
                                                    if (punetItem) {
                                                        const existing = newMaterials.find(m => m.inventoryItemId === punetItem.id);
                                                        if (existing) {
                                                            existing.quantity = finalPunetQty;
                                                        } else {
                                                            newMaterials.push({ inventoryItemId: punetItem.id, quantity: finalPunetQty });
                                                        }
                                                    }
                                                    if (boxItem) {
                                                        const existing = newMaterials.find(m => m.inventoryItemId === boxItem.id);
                                                        if (existing) {
                                                            existing.quantity = finalBoxQty;
                                                        } else {
                                                            newMaterials.push({ inventoryItemId: boxItem.id, quantity: finalBoxQty });
                                                        }
                                                    }
                                                    
                                                    const diffs: Record<string, number> = {};
                                                    newMaterials.forEach(nm => { diffs[nm.inventoryItemId] = nm.quantity; });
                                                    oldMaterials.forEach(om => { diffs[om.inventoryItemId] = (diffs[om.inventoryItemId] || 0) - om.quantity; });
                                                    
                                                    if (inventoryItems && onSetInventoryItems) {
                                                        const updatedInv = inventoryItems.map(invItem => {
                                                            const diff = diffs[invItem.id];
                                                            if (diff) {
                                                                return { ...invItem, currentStock: Math.max(0, invItem.currentStock - diff) };
                                                            }
                                                            return invItem;
                                                        });
                                                        onSetInventoryItems(updatedInv);
                                                    }
                                                    
                                                    const updatedEvent = { ...event, materialsUsed: newMaterials };
                                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                    
                                                    setPkgBoxQty("");
                                                    setPkgPunetQty("");
                                                    toast.success(t('language') === 'ka' ? "მასალები სინქრონიზებულია!" : "Synced to Used Materials!");
                                                }}
                                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1"
                                            >
                                                ➕ {t('language') === 'ka' ? 'ახალი რაოდენობის სინქრონიზაცია' : 'Sync New Quantities'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
"""

start_str = "{/* Packaging & Punet Quantities (Sync to Stock) */}"
end_str = "                    <DailyPaidHarvestCard event={event}"

s_idx = content.find(start_str)
e_idx = content.find(end_str)

if s_idx != -1 and e_idx != -1:
    new_c = content[:s_idx] + get_replacement() + "                    </div>\n" + content[e_idx:]
    with open('src/components/Harvesting/HarvestDashboard.tsx', 'w') as f:
        f.write(new_c)
    print("Replaced UI")
else:
    print("Not found")

