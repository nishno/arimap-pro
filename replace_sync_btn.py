import re

with open('src/components/Harvesting/HarvestDashboard.tsx', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'onClick={() => {' in line and 'const punetItem = inventoryItems.find' in lines[i+1] and 'const finalBoxQty =' in lines[i+5]:
        start_idx = i
    if 'toast.success(' in line and 'Synced to Used Materials!' in line and start_idx != -1 and end_idx == -1:
        end_idx = i + 1

new_content = """                                        onClick={() => {
                                            const punetItem = inventoryItems.find(i => i.name.toLowerCase().includes('punet') || i.name.toLowerCase().includes('პუნეტი'));
                                            const boxItem = inventoryItems.find(i => i.name.toLowerCase().includes('box') || i.name.toLowerCase().includes('ყუთი') || i.category === 'Packaging');
                                            
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
                                                        return { ...invItem, quantity: Math.max(0, invItem.quantity - diff) };
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
"""

if start_idx != -1 and end_idx != -1:
    lines = lines[:start_idx] + [new_content] + lines[end_idx:]
    with open('src/components/Harvesting/HarvestDashboard.tsx', 'w') as f:
        f.writelines(lines)
    print("Replaced onClick")
else:
    print("Not found", start_idx, end_idx)
