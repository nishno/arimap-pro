const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

// 1. Restore the Packaging OPEX Sync block that was deleted
const packagingBlock = `
                        {/* Packaging & Punet Quantities (Sync to Stock) */}
                        <div className="pt-2 border-t border-slate-200">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-[8px] font-black text-amber-900 uppercase tracking-widest block flex items-center gap-1">
                                    <span>📦</span> {t('language') === 'ka' ? 'შეფუთვის და პუნეტების რაოდენობები' : 'Packaging OPEX Sync'}
                                </label>
                            </div>
                            
                            {(() => {
                                const punetItem = inventoryItems.find(i => i.name.toLowerCase().includes('punet') || i.name.toLowerCase().includes('პუნეტი'));
                                const boxItem = inventoryItems.find(i => i.name.toLowerCase().includes('box') || i.name.toLowerCase().includes('ყუთი') || i.category === 'Packaging');
                                
                                const currentSyncedBoxes = event.materialsUsed?.find(m => m.inventoryItemId === boxItem?.id)?.quantity || 0;
                                const currentSyncedPunets = event.materialsUsed?.find(m => m.inventoryItemId === punetItem?.id)?.quantity || 0;
                                
                                return (
                                    <div className="flex flex-col gap-2 bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm">
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[9px] font-bold text-amber-800 uppercase block mb-0.5">Box / Tray Qty</label>
                                                <input 
                                                    type="number" 
                                                    value={pkgBoxQty} 
                                                    onChange={e => setPkgBoxQty(e.target.value)}
                                                    placeholder={currentSyncedBoxes > 0 ? \`Synced: \${currentSyncedBoxes}\` : \`Auto: \${filteredTotals.totalBoxes}\`}
                                                    className="w-full p-1.5 text-xs font-black text-amber-900 border border-amber-300 rounded bg-white outline-none"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-bold text-amber-800 uppercase block mb-0.5">Punet Qty</label>
                                                <input 
                                                    type="number" 
                                                    value={pkgPunetQty} 
                                                    onChange={e => setPkgPunetQty(e.target.value)}
                                                    placeholder={currentSyncedPunets > 0 ? \`Synced: \${currentSyncedPunets}\` : 'Auto'}
                                                    className="w-full p-1.5 text-xs font-black text-amber-900 border border-amber-300 rounded bg-white outline-none"
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
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
                                                
                                                const diffs = {};
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
                                                
                                                const updatedEvent = { 
                                                    ...event, 
                                                    materialsUsed: newMaterials,
                                                    totalBoxes: finalBoxQty, // Sync to Yield Control Total Boxes
                                                    physicalBoxes: finalBoxQty, // Sync to Yield Control Physical Boxes
                                                    physicalPunets: finalPunetQty
                                                };
                                                if (onSetHarvestEvents) {
                                                    onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                }
                                                
                                                setPkgBoxQty("");
                                                setPkgPunetQty("");
                                                toast.success("Synced to Stock & Yield Control!");
                                            }}
                                            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-md"
                                        >
                                            {t('language') === 'ka' ? 'სინქრონიზაცია მარაგებთან და მოსავალთან' : 'Sync to Stock & Yield Control'}
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
`;

file = file.replace(
    /\{\/\* Other custom items \*\/\}/,
    packagingBlock + "\n                        {/* Other custom items */}"
);


// 2. Fix Assigned Vehicles to use machinery dropdown
file = file.replace(
    /type="text"\s*placeholder=\{t\('harvest\.vehicle_name'\) \|\| 'Vehicle Name'\}\s*className="flex-1 p-1\.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"\s*value=\{newVehicleName\}\s*onChange=\{\(e\) => setNewVehicleName\(e\.target\.value\)\}/,
    `as="select"
                                            className="flex-1 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"
                                            value={newVehicleName}
                                            onChange={(e: any) => setNewVehicleName(e.target.value)}
                                        >
                                            <option value="">Select Asset</option>
                                            {machinery.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select`
);
file = file.replace(/<input\s*as="select"/, '<select');

// 3. Fix the "Add Vehicle" button logic
file = file.replace(
    /const cost = parseFloat\(newVehicleCost\);\s*if \(newVehicleName\.trim\(\) && !isNaN\(cost\) && cost >= 0\) \{/,
    `const cost = parseFloat(newVehicleCost);
                                                if (newVehicleName.trim() && !isNaN(cost) && cost >= 0) {
                                                    const machine = machinery.find(m => m.id === newVehicleName);
                                                    const name = machine ? machine.name : newVehicleName;`
);

// Actually, wait, the vehicle object in event.assignedVehicles takes { machineryId, isOwned, usageHours, hiredCost }
// If we add to event.assignedVehicles, let's just make it a simple list of machinery IDs or text
// But HarvestEvent.assignedVehicles is of type { machineryId?: string, isOwned: boolean, usageHours: number, hiredCost?: number }
// Let's modify the Add Vehicle button logic:
file = file.replace(
    /const newItem = \{\n\s*id: `vh-\$\{Date\.now\(\)\}`,\n\s*name: newVehicleName,\n\s*cost: cost\n\s*\};/,
    `const newItem = {
                                                        machineryId: newVehicleName,
                                                        isOwned: true,
                                                        usageHours: cost,
                                                        hiredCost: 0
                                                    };`
);
// wait, if we change the structure, the display map function below it will break!
file = file.replace(
    /const currentVehicles = event\.assignedVehicles \|\| \[\];\n\s*const updatedEvent = \{ \.\.\.event, assignedVehicles: \[\.\.\.currentVehicles, newItem\] \};/,
    `const currentVehicles = event.assignedVehicles || [];
                                                    const updatedEvent = { ...event, assignedVehicles: [...currentVehicles, newItem] };`
);

// We need to fix the vehicle display map too:
file = file.replace(
    /\{event\.assignedVehicles\?\.map\(vh => \(\n\s*<div key=\{vh\.id\} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">\n\s*<div className="flex items-center gap-2">\n\s*<div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-500">\n\s*<TractorIcon size=\{12\} \/>\n\s*<\/div>\n\s*<span className="font-bold text-slate-600">\{vh\.name\}<\/span>\n\s*<\/div>\n\s*<div className="flex items-center gap-1\.5 bg-white">\n\s*<span className="font-black text-slate-800">\n\s*\{currency === 'GEL' \? \`GEL \$\{vh\.cost\.toFixed\(2\)\}\` : \`\$\$\{vh\.cost\.toFixed\(2\)\}\`\}\n\s*<\/span>\n\s*<button\n\s*onClick=\{\(\) => \{\n\s*const updatedVehicles = \(event\.assignedVehicles \|\| \[\]\)\.filter\(v => v\.id !== vh\.id\);\n\s*const updatedEvent = \{ \.\.\.event, assignedVehicles: updatedVehicles \};\n\s*onSetHarvestEvents\(\(harvestEvents \|\| \[\]\)\.map\(e => e\.id === event\.id \? updatedEvent : e\)\);\n\s*\}\}\n\s*className="text-red-500 hover:text-red-700 font-extrabold text-xs"\n\s*>\n\s*×\n\s*<\/button>\n\s*<\/div>\n\s*<\/div>\n\s*\)\)\}/g,
    `{event.assignedVehicles?.map((vh: any, idx) => {
                                        const m = machinery.find(m => m.id === vh.machineryId);
                                        return (
                                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-500">
                                                    <span>🚜</span>
                                                </div>
                                                <span className="font-bold text-slate-600">{m?.name || vh.machineryId}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white">
                                                <span className="font-black text-slate-800">
                                                    {vh.usageHours} hrs
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const updatedVehicles = [...(event.assignedVehicles || [])];
                                                        updatedVehicles.splice(idx, 1);
                                                        const updatedEvent = { ...event, assignedVehicles: updatedVehicles };
                                                        onSetHarvestEvents?.((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                    }}
                                                    className="text-red-500 hover:text-red-700 font-extrabold text-xs"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    )})} `
);

// 4. Fix Used Materials to use inventory dropdown
file = file.replace(
    /type="text"\s*placeholder=\{t\('harvest\.material_name'\) \|\| 'Material ID'\}\s*className="flex-1 p-1\.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"\s*value=\{newMaterialId\}\s*onChange=\{\(e\) => setNewMaterialId\(e\.target\.value\)\}/,
    `as="select"
                                            className="flex-1 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 font-sans"
                                            value={newMaterialId}
                                            onChange={(e: any) => setNewMaterialId(e.target.value)}
                                        >
                                            <option value="">Select Material</option>
                                            {inventoryItems.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select`
);
file = file.replace(/<input\s*as="select"/, '<select');

// Fix material Add logic
file = file.replace(
    /const newItem = \{\n\s*inventoryItemId: newMaterialId,\n\s*quantity: qty\n\s*\};/,
    `const newItem = {
                                                        inventoryItemId: newMaterialId,
                                                        quantity: qty
                                                    };`
);

// Fix material display map
file = file.replace(
    /\{event\.materialsUsed\?\.map\(\(mat, idx\) => \(\n\s*<div key=\{idx\} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">\n\s*<div className="flex items-center gap-2">\n\s*<div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center text-emerald-500">\n\s*<ShieldCheckIcon size=\{12\} \/>\n\s*<\/div>\n\s*<span className="font-bold text-slate-600">\{mat\.inventoryItemId\}<\/span>\n\s*<\/div>\n\s*<div className="flex items-center gap-1\.5 bg-white">\n\s*<span className="font-black text-slate-800">\n\s*\{mat\.quantity\}\n\s*<\/span>\n\s*<button\n\s*onClick=\{\(\) => \{\n\s*const currentMaterials = \[\.\.\.\(event\.materialsUsed \|\| \[\]\)\];\n\s*currentMaterials\.splice\(idx, 1\);\n\s*const updatedEvent = \{ \.\.\.event, materialsUsed: currentMaterials \};\n\s*onSetHarvestEvents\(\(harvestEvents \|\| \[\]\)\.map\(e => e\.id === event\.id \? updatedEvent : e\)\);\n\s*\}\}\n\s*className="text-red-500 hover:text-red-700 font-extrabold text-xs"\n\s*>\n\s*×\n\s*<\/button>\n\s*<\/div>\n\s*<\/div>\n\s*\)\)\}/g,
    `{event.materialsUsed?.map((mat: any, idx) => {
                                        const m = inventoryItems.find(i => i.id === mat.inventoryItemId);
                                        return (
                                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center text-emerald-500">
                                                    <span>📦</span>
                                                </div>
                                                <span className="font-bold text-slate-600">{m?.name || mat.inventoryItemId}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white">
                                                <span className="font-black text-slate-800">
                                                    {mat.quantity} {m?.unitOfMeasure || 'units'}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const currentMaterials = [...(event.materialsUsed || [])];
                                                        currentMaterials.splice(idx, 1);
                                                        const updatedEvent = { ...event, materialsUsed: currentMaterials };
                                                        onSetHarvestEvents?.((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));
                                                    }}
                                                    className="text-red-500 hover:text-red-700 font-extrabold text-xs"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    )})} `
);

// Write to file
fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
