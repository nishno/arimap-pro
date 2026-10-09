const fs = require('fs');
let file = fs.readFileSync('src/components/HarvestingStats.tsx', 'utf8');

// 1. Add Update All button
const saveBlockTarget = `                        <button 
                            onClick={handleSave} 
                            className="px-4 py-2 bg-[#1D63ED] hover:bg-[#1552cd] text-white rounded-2xl font-extrabold text-xs transition-all shadow-xs cursor-pointer"
                        >
                            {t('adv.save_adjustments') || 'Save Adjustments'}
                        </button>`;

const newSaveBlock = `                        <button 
                            onClick={() => handleSave(false)} 
                            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl font-extrabold text-xs transition-all shadow-xs cursor-pointer"
                        >
                            {isKa ? 'შენახვა (ლოკალურად)' : 'Save (Offline)'}
                        </button>
                        <button 
                            onClick={() => handleSave(true)} 
                            className="px-4 py-2 bg-[#1D63ED] hover:bg-[#1552cd] text-white rounded-2xl font-extrabold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            {isKa ? 'ატვირთვა (Update All)' : 'Sync to Cloud (Update All)'}
                        </button>`;

file = file.replace(saveBlockTarget, newSaveBlock);

// 2. Change handleSave signature and behavior
const handleSaveTarget = `    const handleSave = () => {`;
const newHandleSave = `    const handleSave = (syncToCloud = true) => {`;
file = file.replace(handleSaveTarget, newHandleSave);

// 3. Update the callbacks inside handleSave
const oldSetHarvestEvents = `        onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e));`;
const newSetHarvestEvents = `        onSetHarvestEvents((harvestEvents || []).map(e => e.id === event.id ? updatedEvent : e), syncToCloud);`;
file = file.replace(oldSetHarvestEvents, newSetHarvestEvents);

const oldSetInventoryItems = `            onSetInventoryItems(updatedInv);`;
const newSetInventoryItems = `            (onSetInventoryItems as any)(updatedInv, syncToCloud);`;
file = file.replace(oldSetInventoryItems, newSetInventoryItems);

const oldSetEmployees = `                onSetEmployees(updatedEmployees);`;
const newSetEmployees = `                (onSetEmployees as any)(updatedEmployees, syncToCloud);`;
file = file.replace(oldSetEmployees, newSetEmployees);

const toastSuccessTarget = `        toast.success((t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') ? "ცვლილებები წარმატებით შენახულია!" : "Adjustments & Rates Saved Successfully!");`;
const newToastSuccess = `        toast.success((t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka') 
            ? (syncToCloud ? "სინქრონიზაცია წარმატებულია!" : "ლოკალურად შენახულია!") 
            : (syncToCloud ? "Synced to Cloud Successfully!" : "Saved Offline Locally!"));`;
file = file.replace(toastSuccessTarget, newToastSuccess);

// Update PickerStats signature to include syncToCloud on onSetHarvestEvents
const pickerStatsSignatureOld = `    onSetHarvestEvents: (events: HarvestEvent[]) => void;`;
const pickerStatsSignatureNew = `    onSetHarvestEvents: (events: HarvestEvent[], syncToCloud?: boolean) => void;`;
file = file.replace(pickerStatsSignatureOld, pickerStatsSignatureNew);

fs.writeFileSync('src/components/HarvestingStats.tsx', file);
