const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

const target = `                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>`;

const replacement = `                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Assigned Vehicles */}
                        <div className="border-t pt-2 border-slate-100 mt-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t('harvest.assigned_vehicles')}</label>
                                <button 
                                    onClick={() => {
                                        setIsAddingVehicle(!isAddingVehicle);
                                    }}
                                    className="text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:underline text-right"
                                >
                                    {isAddingVehicle ? (t('common.cancel') || 'Cancel') : t('common.add') || 'Add'}
                                </button>
                            </div>
                            
                            {isAddingVehicle && (
                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2 mt-1 mb-2 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            placeholder={t('harvest.vehicle_name') || 'Vehicle Name'}
                                            className="flex-1 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"
                                            value={newVehicleName}
                                            onChange={(e) => setNewVehicleName(e.target.value)}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder={'Cost'}
                                            className="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"
                                            value={newVehicleCost}
                                            onChange={(e) => setNewVehicleCost(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button 
                                            onClick={() => {
                                                setIsAddingVehicle(false);
                                                setNewVehicleName("");
                                                setNewVehicleCost("");
                                            }}
                                            className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                                        >
                                            {t('common.cancel') || 'Cancel'}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const cost = parseFloat(newVehicleCost) || 0;
                                                if (newVehicleName.trim()) {
                                                    const currentItems = event.assignedVehicles || [];
                                                    const updatedItems = [...currentItems, { name: newVehicleName.trim(), hiredCost: cost, isOwned: cost === 0, usageHours: 0 }];
                                                    const updatedEvent = { ...event, assignedVehicles: updatedItems };
                                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                    setIsAddingVehicle(false);
                                                    setNewVehicleName("");
                                                    setNewVehicleCost("");
                                                }
                                            }}
                                            className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 rounded-lg transition-all shadow-md active:scale-95"
                                        >
                                            {t('common.save') || 'Save'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                {(event.assignedVehicles || []).map((v, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-1.5 rounded-xl border border-slate-100 text-[10px]">
                                        <span className="font-bold text-slate-600">{v.name}</span>
                                        <div className="flex items-center gap-1.5 bg-white">
                                            {v.hiredCost > 0 && (
                                                <span className="font-black text-slate-800">
                                                    {currency === 'GEL' ? \`GEL \${v.hiredCost.toFixed(2)}\` : \`$\${v.hiredCost.toFixed(2)}\`}
                                                </span>
                                            )}
                                            <button 
                                                onClick={() => {
                                                    const updatedItems = (event.assignedVehicles || []).filter((_, i) => i !== idx);
                                                    const updatedEvent = { ...event, assignedVehicles: updatedItems };
                                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                }}
                                                className="text-red-500 hover:text-red-700 font-extrabold text-xs"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Used Materials */}
                        <div className="border-t pt-2 border-slate-100 mt-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Used Materials</label>
                                <button 
                                    onClick={() => {
                                        setIsAddingMaterial(!isAddingMaterial);
                                    }}
                                    className="text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:underline text-right"
                                >
                                    {isAddingMaterial ? (t('common.cancel') || 'Cancel') : t('common.add') || 'Add'}
                                </button>
                            </div>
                            
                            {isAddingMaterial && (
                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2 mt-1 mb-2 shadow-sm">
                                    <div className="flex flex-col gap-2">
                                        <select 
                                            value={newMaterialId} 
                                            onChange={(e) => setNewMaterialId(e.target.value)}
                                            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                                        >
                                            <option value="">Select Material...</option>
                                            {inventoryItems.filter(i => i.category !== 'Produce').map(item => (
                                                <option key={item.id} value={item.id}>{item.name} (Stock: {item.currentStock})</option>
                                            ))}
                                        </select>
                                        <input 
                                            type="number" 
                                            placeholder="Qty"
                                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"
                                            value={newMaterialQty}
                                            onChange={(e) => setNewMaterialQty(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button 
                                            onClick={() => {
                                                setIsAddingMaterial(false);
                                                setNewMaterialId("");
                                                setNewMaterialQty("");
                                            }}
                                            className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                                        >
                                            {t('common.cancel') || 'Cancel'}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const qty = parseFloat(newMaterialQty) || 0;
                                                if (newMaterialId && qty > 0) {
                                                    const currentItems = event.materialsUsed || [];
                                                    const existing = currentItems.find(m => m.inventoryItemId === newMaterialId);
                                                    let updatedItems;
                                                    if (existing) {
                                                        updatedItems = currentItems.map(m => m.inventoryItemId === newMaterialId ? { ...m, quantity: m.quantity + qty } : m);
                                                    } else {
                                                        updatedItems = [...currentItems, { inventoryItemId: newMaterialId, quantity: qty }];
                                                    }
                                                    
                                                    // Also deduct from stock immediately if we want like Packaging OPEX does?
                                                    if (inventoryItems && onSetInventoryItems) {
                                                        const updatedInv = inventoryItems.map(invItem => {
                                                            if (invItem.id === newMaterialId) {
                                                                return { ...invItem, currentStock: Math.max(0, invItem.currentStock - qty) };
                                                            }
                                                            return invItem;
                                                        });
                                                        onSetInventoryItems(updatedInv);
                                                    }

                                                    const updatedEvent = { ...event, materialsUsed: updatedItems };
                                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                    setIsAddingMaterial(false);
                                                    setNewMaterialId("");
                                                    setNewMaterialQty("");
                                                }
                                            }}
                                            className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 rounded-lg transition-all shadow-md active:scale-95"
                                        >
                                            {t('common.save') || 'Save'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                {(event.materialsUsed || []).map((m, idx) => {
                                    const itemName = inventoryItems.find(i => i.id === m.inventoryItemId)?.name || 'Unknown Material';
                                    return (
                                        <div key={idx} className="flex justify-between items-center bg-white p-1.5 rounded-xl border border-slate-100 text-[10px]">
                                            <span className="font-bold text-slate-600">{itemName}</span>
                                            <div className="flex items-center gap-1.5 bg-white">
                                                <span className="font-black text-slate-800">
                                                    {m.quantity}
                                                </span>
                                                <button 
                                                    onClick={() => {
                                                        // Restore stock when deleted? Optional but good practice.
                                                        if (inventoryItems && onSetInventoryItems) {
                                                            const updatedInv = inventoryItems.map(invItem => {
                                                                if (invItem.id === m.inventoryItemId) {
                                                                    return { ...invItem, currentStock: invItem.currentStock + m.quantity };
                                                                }
                                                                return invItem;
                                                            });
                                                            onSetInventoryItems(updatedInv);
                                                        }

                                                        const updatedItems = (event.materialsUsed || []).filter((_, i) => i !== idx);
                                                        const updatedEvent = { ...event, materialsUsed: updatedItems };
                                                        onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                    }}
                                                    className="text-red-500 hover:text-red-700 font-extrabold text-xs"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>`;

file = file.replace(target, replacement);
fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
