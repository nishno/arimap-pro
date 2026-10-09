sed -i '2545,2546c\
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">\
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">{t('"'"'harvest.costs_filters'"'"')}</label>\
                        \
                        {/* 1. Workers Salary with link to Yield Control */}\
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl shadow-sm border border-slate-100">\
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Workers Salary</span>\
                            <button \
                                onClick={() => setShowDailyHarvestModal(true)}\
                                className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors uppercase"\
                            >\
                                Yield Control &rarr;\
                            </button>\
                        </div>\
                        \
                        {/* 2. Unified Buttons */}\
                        <div className="grid grid-cols-2 gap-2 mt-2">\
                            <button\
                                onClick={() => setShowDailyHarvestModal(true)}\
                                className="bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-700 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"\
                            >\
                                <span className="text-base">🚜</span>\
                                Vehicles +\
                            </button>\
                            <button\
                                onClick={() => setShowDailyHarvestModal(true)}\
                                className="bg-amber-50 border border-amber-100 hover:bg-amber-100 text-amber-700 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"\
                            >\
                                <span className="text-base">📦</span>\
                                Materials +\
                            </button>\
                        </div>\
                        \
                        {/* 3. Packaging & Punet OPEX field */}\
                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">\
                            <div>\
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Packaging & Punet OPEX</label>\
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Based on {(filteredTotals.totalBoxes || 0)} Boxes</span>\
                            </div>\
                            <div className="text-sm font-black text-slate-800">\
                                {formatCurrency(((filteredTotals.totalBoxes || 0) * (event.boxUnitCost ?? 0.8)) + ((filteredTotals.totalBoxes || 0) * (event.punetsPerBox || 12) * (event.punetUnitCost ?? 0.15)))}\
                            </div>\
                        </div>\
' src/components/Harvesting/HarvestDashboard.tsx
