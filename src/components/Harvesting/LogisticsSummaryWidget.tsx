import React from 'react';
import { HarvestEvent, InventoryItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Truck, Package } from 'lucide-react';

interface Props {
    event: HarvestEvent;
    inventoryItems: InventoryItem[];
}

export const LogisticsSummaryWidget: React.FC<Props> = ({ event, inventoryItems }) => {
    const { t } = useLanguage();
    const vehicleCount = event.assignedVehicles?.length || 0;
    const materialCount = event.materialsUsed?.reduce((sum, m) => sum + m.quantity, 0) || 0;

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                    <Truck size={20} className="text-indigo-600" />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transport</p>
                    <p className="font-black text-gray-800 text-sm">{vehicleCount} Vehicles Assigned</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 border-l border-gray-100 pl-4">
                <div className="p-2 bg-amber-50 rounded-lg">
                    <Package size={20} className="text-amber-600" />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Materials</p>
                    <p className="font-black text-gray-800 text-sm">{materialCount} Items Used</p>
                </div>
            </div>
        </div>
    );
};
