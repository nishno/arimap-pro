const fs = require('fs');

const path = 'src/components/Harvesting/LogisticsTransportWidget.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `{isAddingVehicle && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Select Vehicle</label>
                                <select value={vehicleId} onChange={e => { setVehicleId(e.target.value); if (e.target.value) setCustomVehicleName(''); }} className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs">
                                    <option value="">-- Custom --</option>
                                    {machinery.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Or Type Name</label>
                                <input type="text" value={customVehicleName} onChange={e => { setCustomVehicleName(e.target.value); setVehicleId(''); }} placeholder="e.g. Ford Transit" className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Type</label>
                                <select value={vehicleType} onChange={e => setVehicleType(e.target.value as any)} className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs">
                                    <option value="cargo">Cargo (Boxes)</option>
                                    <option value="passenger">Passenger (Workers)</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Workers Brought</label>
                                <input type="number" disabled={vehicleType !== 'passenger'} value={passengerCount} onChange={e => setPassengerCount(e.target.value ? Number(e.target.value) : '')} placeholder="Count (if passenger)" className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs disabled:opacity-50" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Select Foreman / Driver</label>
                                <select value={foremanId} onChange={e => { setForemanId(e.target.value); if (e.target.value) setCustomForemanName(''); }} className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs">
                                    <option value="">-- Custom --</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Or Type Foreman</label>
                                <input type="text" value={customForemanName} onChange={e => { setCustomForemanName(e.target.value); setForemanId(''); }} placeholder="e.g. John Doe" className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Rate Type</label>
                                <select value={rateType} onChange={e => setRateType(e.target.value as any)} className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs">
                                    <option value="fixed">Fixed Cost / Trip</option>
                                    <option value="daily">Daily Rate</option>
                                    <option value="per_person">Per Person</option>
                                    <option value="per_kg">Per KG Transported</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Amount (GEL)</label>
                                <input type="number" value={rateAmount} onChange={e => setRateAmount(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 50" className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs" />
                            </div>
                        </div>
                        
                        <button onClick={handleAddVehicle} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-black text-[10px] uppercase tracking-widest rounded shadow active:scale-[0.98]">
                            Assign Transport
                        </button>
                    </div>
                )}`;

const replacement = `{isAddingVehicle && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Select Vehicle</label>
                                <select value={vehicleId} onChange={e => handleVehicleChange(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs">
                                    <option value="">-- Custom --</option>
                                    {machinery.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} {m.vehicleCategory ? \`(\${m.vehicleCategory})\` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Or Type Name</label>
                                <input type="text" value={customVehicleName} onChange={e => { setCustomVehicleName(e.target.value); setVehicleId(''); }} placeholder="e.g. Ford Transit" className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Select Foreman / Driver</label>
                                <select value={foremanId} onChange={e => { setForemanId(e.target.value); if (e.target.value) setCustomForemanName(''); }} className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs">
                                    <option value="">-- Custom --</option>
                                    {employees.filter(e => e.role === 'Foreman').map(e => (
                                        <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Type</label>
                                <select value={vehicleType} onChange={e => setVehicleType(e.target.value as any)} className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs">
                                    <option value="cargo">Cargo (Boxes)</option>
                                    <option value="passenger">Passenger (Workers)</option>
                                    <option value="tractor">Tractor & Heavy Machinery</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        {vehicleType === 'passenger' && (
                            <div className="bg-white p-3 rounded border border-gray-200 space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase flex justify-between">
                                        <span>Workers Brought</span>
                                        {vehicleId && machinery.find(m => m.id === vehicleId)?.passengerCapacity && (
                                            <span className="text-indigo-500">Max Cap: {machinery.find(m => m.id === vehicleId)?.passengerCapacity}</span>
                                        )}
                                    </label>
                                    <input type="number" value={passengerCount} onChange={e => setPassengerCount(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 10" className="w-full p-2 bg-slate-50 border border-gray-200 rounded outline-none text-xs" />
                                </div>
                                {foremanId && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Select Pickers (Optional)</label>
                                        <div className="max-h-32 overflow-y-auto border border-gray-100 rounded p-1">
                                            {employees.filter(e => e.role === 'Picker').map(e => (
                                                <label key={e.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer text-xs">
                                                    <input type="checkbox" checked={linkedWorkerIds.includes(e.id)} onChange={ev => {
                                                        if (ev.target.checked) {
                                                            setLinkedWorkerIds([...linkedWorkerIds, e.id]);
                                                            setPassengerCount((prev) => (Number(prev) || 0) + 1);
                                                        } else {
                                                            setLinkedWorkerIds(linkedWorkerIds.filter(id => id !== e.id));
                                                            setPassengerCount((prev) => Math.max(0, (Number(prev) || 1) - 1));
                                                        }
                                                    }} />
                                                    <span>{e.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Rate Type</label>
                                <select value={rateType} onChange={e => setRateType(e.target.value as any)} className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs">
                                    <option value="fixed">Fixed Cost / Trip</option>
                                    <option value="daily">Daily Rate</option>
                                    <option value="per_person">Per Person</option>
                                    <option value="per_kg">Per KG Transported</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Unit Amount (GEL)</label>
                                <input type="number" value={rateAmount} onChange={e => setRateAmount(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 5" className="w-full p-2 bg-white border border-gray-200 rounded outline-none text-xs" />
                            </div>
                        </div>

                        {rateType === 'per_person' && (
                            <div className="text-right text-[10px] font-bold text-gray-600">
                                Total Cost Output: <span className="text-indigo-600">{(Number(rateAmount) || 0) * (Number(passengerCount) || 0)} GEL</span>
                            </div>
                        )}
                        
                        <button onClick={handleAddVehicle} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-black text-[10px] uppercase tracking-widest rounded shadow active:scale-[0.98]">
                            Assign Transport
                        </button>
                    </div>
                )}`;

if (code.includes(targetStr)) {
    fs.writeFileSync(path, code.replace(targetStr, replacement));
    console.log("Replaced");
} else {
    console.log("Not found, string starts with: " + code.substring(code.indexOf('{isAddingVehicle &&'), code.indexOf('{isAddingVehicle &&') + 100));
}
