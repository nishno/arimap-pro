
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { User, InventoryItem, InventoryTransaction, InventoryCategory, Supplier, PurchaseOrder, PurchaseOrderItem, NutritionPlan, PlanExecution, HarvestEntry, WorkAssignment, DashboardWidget, HarvestEvent, Account, Transaction, Permission, StockTransaction, HarvestedProduce, Employee, Role, EmployeeGroup, PlantationFeature, AreaPlantationFeature, Machinery, Crop, RefrigeratorLot, StockChargeReasonCategory, SubStock } from '../types';
import { getInventoryEligibleEmployees } from '../utils/employeeFilters';
import { PlusCircleIcon, SearchIcon, AlertTriangleIcon, PencilSquareIcon, TrashIcon, XCircleIcon, DocumentTextIcon, ArrowPathIcon, ChevronUpIcon, ChevronDownIcon, BanknotesIcon, BuildingStorefrontIcon, TagIcon, ShoppingBagIcon, CheckIcon, WrenchScrewdriverIcon, BeakerIcon, LeafIcon, TractorIcon, ShieldCheckIcon, ArrowsRightLeftIcon } from './Icons';

const STOCK_CATEGORY_GROUPS = {
    agroinputs: ['Fertilizers', 'Pesticides', 'Chemicals', 'Bio-stimulants', 'Seeds'] as InventoryCategory[],
    supplies: ['Packaging', 'Pallets', 'Fuel', 'Spare Parts', 'Construction', 'Consumables', 'Tools', 'Other'] as InventoryCategory[],
    machinery: ['Machinery', 'Fixed Assets', 'Tools'] as InventoryCategory[],
};
import StockItemModal from './StockItemModal';
import MergeItemsModal from './MergeItemsModal';
import PurchaseOrderModal from './PurchaseOrderModal';
import ItemHistoryModal from './ItemHistoryModal';
import DirectStockChargeModal, { DirectStockChargeData } from './DirectStockChargeModal';
import WidgetActionToolbar from './WidgetActionToolbar';
import HarvestEventModal from './HarvestEventModal';
import HarvestAiAnalysisModal from './HarvestAiAnalysisModal';
import SelectedSalesAnalyticsModal from './SelectedSalesAnalyticsModal';
import HarvestCommercialModal from './HarvestCommercialModal';
import RefrigeratorView from './RefrigeratorView';
import { HarvestProduceList } from './HarvestProduceList';
import { HarvestSalesList } from './HarvestSalesList';
import { Brain, Sparkles, Snowflake, FileSpreadsheet, ScanLine, QrCode, Folder, Warehouse, ArrowRightLeft, PackagePlus, Layers, Boxes, Box, ClipboardCheck } from 'lucide-react';
import StockDocumentsFolder from './StockDocumentsFolder';
import SubStocksManager from './Stock/SubStocksManager';
import StockTransferModal from './Stock/StockTransferModal';
import QuickAddUncategorizedModal from './Stock/QuickAddUncategorizedModal';
import OrdersSection from './Stock/OrdersSection';
import BureaucracySection from './Stock/BureaucracySection';
import { safeStorage } from '../services/storageService';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { calculatePickerEarnings, calculateNetDurationHours } from './HarvestingStats';
import { exportToExcel } from '../utils/excelExporter';
import { GoogleSheetsModal, GoogleSheetsModuleType } from './GoogleSheetsModal';
import MachineryManager from './SystemManagement/MachineryManager';
import QrScannerModal, { ScannerCategory, ParsedScanResult } from './QrScannerModal';
import MaterialQrGeneratorModal from './MaterialQrGeneratorModal';
import { parseUniversalScan } from '../utils/universalScannerParser';


export interface StockViewProps {
    currentUser: User | null;
    inventoryItems: InventoryItem[];
    onSetInventoryItems: (items: InventoryItem[]) => void;
    inventoryTransactions: InventoryTransaction[];
    onSetInventoryTransactions: (transactions: InventoryTransaction[]) => void;
    suppliers: Supplier[];
    onSetSuppliers: (suppliers: Supplier[]) => void;
    purchaseOrders: PurchaseOrder[];
    onSetPurchaseOrders: (orders: PurchaseOrder[]) => void;
    currentUserPermissions: Set<Permission>;
    nutritionPlans?: NutritionPlan[];
    planExecutions?: PlanExecution[];
    harvestEntries?: HarvestEntry[];
    workAssignments?: WorkAssignment[];
    harvestEvents?: HarvestEvent[];
    onSetHarvestEvents?: (events: HarvestEvent[]) => void;
    plantationFeatures?: PlantationFeature[];
    employees?: Employee[];
    onSetEmployees?: (employees: Employee[]) => void;
    roles?: Role[];
    employeeGroups?: EmployeeGroup[];
    accounts?: Account[];
    onSetAccounts?: (accounts: Account[]) => void;
    transactions?: Transaction[];
    stockTransactions?: StockTransaction[];
    onSetStockTransactions?: (transactions: StockTransaction[]) => void;
    harvestedProduce?: HarvestedProduce[];
    onSetTransactions?: (transactions: Transaction[]) => void;
    onAddToDashboard?: (widget: Omit<DashboardWidget, 'id' | 'order' | 'isVisible'>) => void;
    machinery?: Machinery[];
    onSetMachinery?: (machinery: Machinery[]) => void;
    crops?: Crop[];
    cropVarieties?: string[];
}

const TabButton: React.FC<{ active: boolean, onClick: () => void, label: string, icon?: React.ReactNode }> = ({ active, onClick, label, icon }) => (
    <button onClick={onClick} className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest rounded-t-2xl flex items-center gap-2 whitespace-nowrap transition-all ${active ? 'bg-white text-blue-600 border-b-4 border-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
        {icon}
        {label}
    </button>
);

const StatCard: React.FC<{ title: string; value: string | number; color: string; subtitle?: string; onAddToDashboard?: () => void; }> = ({ title, value, color, subtitle, onAddToDashboard }) => (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 group flex flex-col justify-between">
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
            <p className={`text-xl md:text-2xl font-black mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs font-bold text-sky-600 mt-2 tracking-wide">{subtitle}</p>}
        </div>
        {onAddToDashboard && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                <WidgetActionToolbar 
                    onAddToDashboard={onAddToDashboard} 
                    onShare={() => alert(`Shared stats: ${title} - ${value}`)} 
                />
            </div>
        )}
    </div>
);

const PurchasesList: React.FC<StockViewProps> = (props) => {
    const { formatCurrency } = useLanguage();
    const { currentUser, purchaseOrders = [], onSetPurchaseOrders, suppliers = [], inventoryItems = [], onSetInventoryItems } = props;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);

    const handleSave = (order: PurchaseOrder) => {
        // Detect if transition to Received
        const wasReceived = editingOrder?.status === 'Received';
        const isReceived = order.status === 'Received';
        
        if (isReceived && !wasReceived) {
            // Process items into stock
            let updatedItems = [...inventoryItems];
            const newOrderItems = order.items;
            const newTxs: StockTransaction[] = [];

            newOrderItems.forEach(item => {
                if (!item.addToStock) return;

                // Find existing item by ID or Name
                let existingItemIndex = -1;
                let itemIdToTx = '';
                if (item.inventoryItemId) {
                    existingItemIndex = updatedItems.findIndex(i => i.id === item.inventoryItemId);
                } else if (item.itemName) {
                    existingItemIndex = updatedItems.findIndex(i => i.name.toLowerCase() === item.itemName?.toLowerCase());
                }

                if (existingItemIndex !== -1) {
                    // Update existing
                    const existingItem = updatedItems[existingItemIndex];
                    itemIdToTx = existingItem.id;
                    updatedItems[existingItemIndex] = {
                        ...existingItem,
                        currentStock: (existingItem.currentStock || 0) + item.quantity,
                        unitCost: item.unitCost // Update with latest cost
                    };
                } else if (item.itemName) {
                    // Create new inventory item
                    itemIdToTx = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const newItem: InventoryItem = {
                        id: itemIdToTx,
                        name: item.itemName,
                        category: 'Seeds', 
                        unitOfMeasure: 'kg',
                        currentStock: item.quantity,
                        minStockThreshold: 10,
                        unitCost: item.unitCost,
                        location: 'Central Warehouse'
                    };
                    updatedItems.push(newItem);
                }
                
                if (itemIdToTx && item.quantity > 0) {
                     newTxs.push({
                         id: `tx-stk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                         organizationId: '',
                         date: new Date().toISOString(),
                         itemId: itemIdToTx,
                         type: 'ADDITION',
                         quantity: item.quantity,
                         sourceModule: 'MANUAL',
                         reason: `Received Purchase Order: ${order.id}`
                     });
                }
            });
            onSetInventoryItems(updatedItems);
            
            if (newTxs.length > 0 && props.onSetStockTransactions && props.stockTransactions) {
                props.onSetStockTransactions([...props.stockTransactions, ...newTxs]);
            }
        }

        if (editingOrder) {
            onSetPurchaseOrders(purchaseOrders.map(o => o.id === order.id ? order : o));
        } else {
            onSetPurchaseOrders([...purchaseOrders, order]);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-800">Purchase Orders</h2>
                <button 
                    onClick={() => { setEditingOrder(null); setIsModalOpen(true); }} 
                    disabled={currentUser?.isGuest}
                    className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title={currentUser?.isGuest ? "Verification required" : "New P.O."}
                >
                    New P.O.
                </button>
            </div>
            <div className="overflow-x-auto -mx-4 md:-mx-6">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                        <tr>
                            <th className="px-6 py-4">Order Date</th>
                            <th className="px-6 py-4">Supplier</th>
                            <th className="px-6 py-4 text-right">Total Cost</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {purchaseOrders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-50">
                                <td className="px-6 py-5 whitespace-nowrap font-bold text-slate-800">{new Date(order.date).toLocaleDateString()}</td>
                                <td className="px-6 py-5 whitespace-nowrap">{suppliers.find(s => s.id === order.supplierId)?.name || 'N/A'}</td>
                                <td className="px-6 py-5 text-right font-black text-slate-900">{formatCurrency(order.totalCost)}</td>
                                <td className="px-6 py-5 text-center"><span className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase ${order.status === 'Received' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{order.status}</span></td>
                                <td className="px-6 py-5 text-right"><button onClick={() => { setEditingOrder(order); setIsModalOpen(true); }} className="p-2 bg-slate-100 text-slate-500 rounded-xl"><PencilSquareIcon className="h-5 w-5" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && <PurchaseOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} order={editingOrder} suppliers={suppliers} inventoryItems={inventoryItems} />}
        </div>
    );
};

const SupplierModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (s: Supplier) => void, editingSupplier: Supplier | null }> = ({ isOpen, onClose, onSave, editingSupplier }) => {
    const [form, setForm] = useState({ 
        name: editingSupplier?.name || '', 
        contactPerson: editingSupplier?.contactPerson || '', 
        email: editingSupplier?.email || '', 
        phone: editingSupplier?.phone || '' 
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[1003] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="p-4 border-b font-bold">{editingSupplier ? 'Edit' : 'Add'} Supplier</h3>
                <div className="p-4 space-y-3 text-sm">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Company Name</label>
                        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Supplier Name" className="w-full p-2 border rounded-xl" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Contact Person</label>
                        <input value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} placeholder="Contact Person" className="w-full p-2 border rounded-xl" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email</label>
                        <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className="w-full p-2 border rounded-xl" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Phone</label>
                        <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone" className="w-full p-2 border rounded-xl" />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-2 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg font-bold uppercase text-[10px]">Cancel</button>
                    <button onClick={() => onSave({ id: editingSupplier?.id || '', ...form })} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold uppercase text-[10px]">Save Supplier</button>
                </div>
            </div>
        </div>
    );
};

const SuppliersList: React.FC<StockViewProps> = ({ suppliers = [], onSetSuppliers }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const handleSave = (supplier: Supplier) => {
        if (editingSupplier) {
            onSetSuppliers(suppliers.map(s => s.id === supplier.id ? supplier : s));
        } else {
            onSetSuppliers([...suppliers, { ...supplier, id: `sup-${Date.now()}` }]);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-800">Supplier Directory</h2>
                <button onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">Add Supplier</button>
            </div>
            <div className="overflow-x-auto -mx-4 md:-mx-6">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                        <tr><th className="px-6 py-4">Supplier</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Email / Phone</th><th className="px-6 py-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {suppliers.map(sup => sup && (
                            <tr key={sup.id} className="hover:bg-slate-50">
                                <td className="px-6 py-5 font-bold text-slate-800">{sup.name}</td>
                                <td className="px-6 py-5 text-sm text-slate-500">{sup.contactPerson}</td>
                                <td className="px-6 py-5 text-sm text-slate-500">{sup.email} / {sup.phone}</td>
                                <td className="px-6 py-5 text-right"><button onClick={() => { setEditingSupplier(sup); setIsModalOpen(true); }} className="p-2 bg-slate-100 text-slate-500 rounded-xl"><PencilSquareIcon className="h-5 w-5" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && <SupplierModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} editingSupplier={editingSupplier} />}
        </div>
    );
};


const LockedProduceView: React.FC = () => (
    <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100 text-center space-y-4 max-w-xl mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheckIcon className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Restricted Access</h3>
        <p className="text-slate-500 font-bold text-sm leading-relaxed">
            This module contains highly sensitive harvest yield data and LLC financial transactions. 
            Access is strictly restricted to **Founders** and **Co-Founders**.
        </p>
        <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
            Manage permissions and roles in the Founders Vault.
        </p>
    </div>
);


const INITIAL_SUB_STOCKS: SubStock[] = [
    {
        id: 'sub-north-1',
        name: 'North Plot Field Depot',
        code: 'SUB-NORTH',
        locationDescription: 'Sector 3 & 4 Perimeter Gate',
        managerName: 'Davit Beridze',
        contactPhone: '+995 599 12 34 56',
        connectedToMain: true,
        notes: 'Secured container for daily fertilization and irrigation spare parts',
        createdAt: '2026-06-01'
    },
    {
        id: 'sub-south-2',
        name: 'South Sector Storage Bunker',
        code: 'SUB-SOUTH',
        locationDescription: 'Sector 7 Organic Block',
        managerName: 'Giorgi Melikidze',
        contactPhone: '+995 577 98 76 54',
        connectedToMain: true,
        notes: 'Temperature-controlled storage for bio-stimulants and tools',
        createdAt: '2026-07-15'
    }
];

type StockMainSection = 'main_stock' | 'yield' | 'orders' | 'bureaucracy';

const StockView: React.FC<StockViewProps> = (props) => {
    const { onAddToDashboard, currentUserPermissions, currentUser, inventoryItems = [], harvestEvents = [], plantationFeatures = [], machinery = [], harvestEntries = [], employees = [] } = props;
    const [mainSection, setMainSection] = useState<StockMainSection>('main_stock');
    const [yieldSubTab, setYieldSubTab] = useState<'produce' | 'sales' | 'refrigerator' | 'archive' | 'ledger'>('produce');
    const [mainStockSubTab, setMainStockSubTab] = useState<'catalog' | 'substocks' | 'charges' | 'machinery'>('catalog');
    const [machinerySubTab, setMachinerySubTab] = useState<'fleet' | 'stock'>('fleet');
    const { t, formatCurrency, currency, language } = useLanguage();
    const isKa = language === 'ka';
    const [selectedSectorId, setSelectedSectorId] = useState<string>('all');
    const [isGlobalChargeOpen, setIsGlobalChargeOpen] = useState(false);
    const [globalChargeItem, setGlobalChargeItem] = useState<InventoryItem | null>(null);
    const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
    const [googleSheetsInitialModule, setGoogleSheetsInitialModule] = useState<GoogleSheetsModuleType>('stock');
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [isQrGenModalOpen, setIsQrGenModalOpen] = useState(false);
    const [scannerCategory, setScannerCategory] = useState<ScannerCategory>('auto');
    const [scannerAction, setScannerAction] = useState<'charge' | 'add'>('charge');

    // Sub-Stocks State
    const [subStocks, setSubStocks] = useState<SubStock[]>(() => {
        try {
            const raw = safeStorage.getItem('agrimap_sub_stocks');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error('Failed to load sub-stocks:', e);
        }
        return INITIAL_SUB_STOCKS;
    });

    useEffect(() => {
        try {
            safeStorage.setItem('agrimap_sub_stocks', JSON.stringify(subStocks));
        } catch (e) {
            console.error('Failed to save sub-stocks:', e);
        }
    }, [subStocks]);

    // Custom Categories State
    const [customCategories, setCustomCategories] = useState<string[]>(() => {
        try {
            const raw = safeStorage.getItem('agrimap_custom_categories');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        return ['Irrigation Drip Parts', 'Protective Gear', 'Laboratory Reagents'];
    });

    const handleAddCustomCategory = (cat: string) => {
        if (!cat.trim() || customCategories.includes(cat.trim())) return;
        const updated = [...customCategories, cat.trim()];
        setCustomCategories(updated);
        try {
            safeStorage.setItem('agrimap_custom_categories', JSON.stringify(updated));
        } catch (e) {}
        toast.success(isKa ? `კატეგორია "${cat}" დამატებულია!` : `Category "${cat}" added!`);
    };

    // Inter-Stock Transfer Modal State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferPreselectedItemId, setTransferPreselectedItemId] = useState<string | undefined>();
    const [transferPreselectedSourceId, setTransferPreselectedSourceId] = useState<string>('main');

    // Quick Add Uncategorized Modal State
    const [isQuickDropOpen, setIsQuickDropOpen] = useState(false);

    // Location Filter transferred from SubStocks view
    const [catalogLocationFilter, setCatalogLocationFilter] = useState<string>('all');

    const handleOpenTransfer = (itemId?: string, sourceId?: string) => {
        setTransferPreselectedItemId(itemId);
        setTransferPreselectedSourceId(sourceId || 'main');
        setIsTransferModalOpen(true);
    };

    const getCurrentSheetModule = (): GoogleSheetsModuleType => {
        if (mainSection === 'yield') {
            switch (yieldSubTab) {
                case 'produce': return 'harvest_produce';
                case 'sales': return 'sales';
                case 'refrigerator': return 'cold_storage';
                case 'archive': return 'post_harvest_archive';
                case 'ledger': return 'live_ledger';
                default: return 'harvest_produce';
            }
        }
        if (mainSection === 'orders') return 'purchase_orders';
        if (mainSection === 'bureaucracy') return 'stock';
        if (mainSection === 'main_stock') {
            if (mainStockSubTab === 'charges') return 'direct_charges';
            if (mainStockSubTab === 'machinery') return 'assets';
            return 'stock';
        }
        return 'stock';
    };

    const isFounder = useMemo(() => {
        if (!currentUser) return false;
        const roles = currentUser.roles || [];
        const singleRole = currentUser.role || '';
        return (
            roles.includes('Founder') || 
            roles.includes('Co-Founder') || 
            roles.includes('Admin') || 
            roles.includes('ROOT_SUPER_ADMIN') || 
            singleRole.toLowerCase().includes('founder') ||
            singleRole.toLowerCase().includes('admin') ||
            currentUser.id === 'root-system'
        );
    }, [currentUser]);

    const sectors = useMemo(() => {
        const list: { id: string; name: string }[] = [];
        if (plantationFeatures) {
            plantationFeatures.forEach(f => {
                if (f.type === 'sector' && f.name) {
                    list.push({ id: f.id, name: f.name });
                }
            });
        }
        if (harvestEvents) {
            harvestEvents.forEach(e => {
                if (e.sectorId && !list.some(s => s.id === e.sectorId)) {
                    list.push({ id: e.sectorId, name: `Sector ${e.sectorId}` });
                }
                if (e.sectorIds) {
                    e.sectorIds.forEach(sid => {
                        if (sid && !list.some(s => s.id === sid)) {
                            list.push({ id: sid, name: `Sector ${sid}` });
                        }
                    });
                }
            });
        }
        return list;
    }, [plantationFeatures, harvestEvents]);

    const filteredProduceItems = useMemo(() => {
        let items = inventoryItems.filter(i => i.category === 'Produce' && !i.isPrivate && i.status !== 'COLD_STORAGE_RETURNED');
        if (selectedSectorId !== 'all') {
            items = items.filter(item => {
                const ev = harvestEvents.find(e => e.id === item.relatedHarvestId);
                return ev && (ev.sectorId === selectedSectorId || ev.sectorIds?.includes(selectedSectorId));
            });
        }
        return items;
    }, [inventoryItems, harvestEvents, selectedSectorId]);

    // Metric Calculations for Produce tab
    const publicYieldValue = useMemo(() => {
        return filteredProduceItems.reduce((sum, item) => sum + ((item.currentStock || 0) * (item.unitCost || 0) * (item.rate || 1)), 0);
    }, [filteredProduceItems]);

    const totalHarvestOpex = useMemo(() => {
        // Fast O(1) entry weight lookup map by eventId and employeeId
        const entryWeightMap = new Map<string, number>();
        if (harvestEntries) {
            for (let i = 0; i < harvestEntries.length; i++) {
                const e = harvestEntries[i];
                if (e && e.harvestEventId && e.employeeId) {
                    const key = `${e.harvestEventId}_${e.employeeId}`;
                    entryWeightMap.set(key, (entryWeightMap.get(key) || 0) + (e.netWeightKg || 0));
                }
            }
        }

        const machMap = new Map((machinery || []).map(m => [m.id, m]));
        const invMap = new Map((inventoryItems || []).map(i => [i.id, i]));

        const relatedIds = new Set(filteredProduceItems.map(item => item.relatedHarvestId).filter(Boolean));
        const events = harvestEvents.filter(ev => {
            const matchesSector = selectedSectorId === 'all' || ev.sectorId === selectedSectorId || ev.sectorIds?.includes(selectedSectorId);
            return matchesSector && (relatedIds.has(ev.id) || ev.status === 'completed');
        });

        return events.reduce((sum, ev) => {
            let pickerCost = ev.totalPickerCost || 0;
            if (!pickerCost && ev.assignedPickers && ev.assignedPickers.length > 0) {
                const startStr = ev.actualStartDate || ev.plannedStartDate;
                const endStr = ev.actualEndDate || new Date().toISOString();
                const eventDurationMs = new Date(endStr).getTime() - new Date(startStr).getTime();
                const durationHours = Math.max(0, eventDurationMs / (1000 * 60 * 60));
                ev.assignedPickers.forEach(picker => {
                    const scannedWeight = entryWeightMap.get(`${ev.id}_${picker.employeeId}`) || 0;
                    const finalWeight = picker.manualNetWeight ?? scannedWeight;
                    const finalHours = picker.manualHours ?? durationHours;
                    pickerCost += calculatePickerEarnings(picker, finalWeight, finalHours);
                });
            }

            let vehicleCost = ev.totalVehicleCost || 0;
            if (!vehicleCost && ev.assignedVehicles && ev.assignedVehicles.length > 0) {
                ev.assignedVehicles.forEach(v => {
                    if (v.isOwned) {
                        const mach = machMap.get(v.machineryId);
                        const hourly = mach?.hourlyRate || 0;
                        const fuel = mach?.fuelConsumption || 0;
                        let fuelUnitCost = 0;
                        if (mach?.fuelItemId) {
                            const fuelItem = invMap.get(mach.fuelItemId);
                            fuelUnitCost = fuelItem?.unitCost || 0;
                        }
                        vehicleCost += v.usageHours * (hourly + fuel * fuelUnitCost);
                    } else {
                        vehicleCost += v.hiredCost || 0;
                    }
                });
            }

            let packagingCost = ev.totalPackagingCost || 0;
            if (!packagingCost && ev.materialsUsed && ev.materialsUsed.length > 0) {
                packagingCost = ev.materialsUsed.reduce((sumMat, mu) => {
                    const invItem = invMap.get(mu.inventoryItemId);
                    return sumMat + (mu.quantity * (invItem?.unitCost || 0));
                }, 0);
            }

            return sum + pickerCost + vehicleCost + packagingCost;
        }, 0);
    }, [filteredProduceItems, harvestEvents, selectedSectorId, harvestEntries, machinery, inventoryItems]);

    const totalDepositsOnLLC = useMemo(() => {
        return filteredProduceItems.reduce((sum, item) => sum + (item.depositLLC || 0), 0);
    }, [filteredProduceItems]);

    const totalCashDeposits = useMemo(() => {
        return filteredProduceItems.reduce((sum, item) => sum + (item.physicalCash || 0), 0);
    }, [filteredProduceItems]);

    const totalYieldWeight = useMemo(() => {
        return filteredProduceItems.reduce((sum, item) => sum + (item.currentStock || 0), 0);
    }, [filteredProduceItems]);

    const weightedAveragePrice = useMemo(() => {
        if (!totalYieldWeight) return 0;
        return publicYieldValue / totalYieldWeight;
    }, [publicYieldValue, totalYieldWeight]);

    const dashboardStats = useMemo(() => {
        const visibleItems = inventoryItems.filter(i => !i.isPrivate);
        const totalValue = visibleItems.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
        const lowStockCount = visibleItems.filter(item => item.currentStock < item.minStockThreshold).length;
        const produceItems = visibleItems.filter(i => i.category === 'Produce' && i.status !== 'COLD_STORAGE_RETURNED');
        const produceValue = produceItems.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
        const produceVolume = produceItems.reduce((sum, item) => sum + item.currentStock, 0);

        return {
            itemCount: visibleItems.length,
            totalValue,
            lowStockCount,
            produceCount: produceItems.length,
            produceValue,
            produceVolume
        };
    }, [inventoryItems]);

    const CATEGORY_GROUPS = {
        farming: ['Fertilizers', 'Pesticides'],
        machinery: ['Machinery', 'Tools', 'Fixed Assets'],
        materials: ['Seeds', 'Fuel', 'Packaging', 'Pallets', 'Spare Parts', 'Construction', 'Other']
    };

    const handleExecuteDirectCharge = (chargeData: DirectStockChargeData) => {
        const updatedItems = inventoryItems.map(i => {
            if (i.id === chargeData.itemId) {
                const newStock = Math.round((i.currentStock - chargeData.deductedStockAmount) * 100) / 100;
                return { ...i, currentStock: newStock };
            }
            return i;
        });
        props.onSetInventoryItems(updatedItems);

        const newStockTx: StockTransaction = {
            id: `tx-stk-chg-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
            organizationId: '',
            date: chargeData.date,
            itemId: chargeData.itemId,
            type: 'DEDUCTION',
            quantity: chargeData.deductedStockAmount,
            sourceModule: 'DIRECT_CHARGE',
            reason: `[${chargeData.categoryLabel}] ${chargeData.note}`,
            chargeCategory: chargeData.chargeCategory,
            chargedByUserId: chargeData.chargedByUserId,
            chargedByUserName: chargeData.chargedByUserName,
            responsibleEmployeeId: chargeData.responsibleEmployeeId,
            responsibleEmployeeName: chargeData.responsibleEmployeeName,
            note: chargeData.note,
            unitPriceAtCharge: chargeData.unitPriceAtCharge,
            totalCostCharged: chargeData.totalCostCharged,
            stockBeforeCharge: chargeData.stockBeforeCharge,
            stockAfterCharge: chargeData.stockAfterCharge,
            unitOfMeasure: chargeData.item.unitOfMeasure,
            packageQuantityCharged: chargeData.equivalentPackages,
            massVolumeCharged: chargeData.equivalentMassVolume
        };

        if (props.onSetStockTransactions && props.stockTransactions) {
            props.onSetStockTransactions([newStockTx, ...props.stockTransactions]);
        }

        const newInvTx: InventoryTransaction = {
            id: `tx-inv-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
            itemId: chargeData.itemId,
            date: chargeData.date,
            type: 'out',
            quantity: chargeData.deductedStockAmount,
            reason: `[Direct Charge - ${chargeData.categoryLabel}] ${chargeData.note}`,
            chargedByUserName: chargeData.chargedByUserName,
            chargedByUserId: chargeData.chargedByUserId,
            chargeCategory: chargeData.chargeCategory,
            note: chargeData.note,
            totalCost: chargeData.totalCostCharged
        };

        if (props.onSetInventoryTransactions && props.inventoryTransactions) {
            props.onSetInventoryTransactions([newInvTx, ...props.inventoryTransactions]);
        }

        toast.success(`Direct Charge logged: -${chargeData.deductedStockAmount} ${chargeData.item.unitOfMeasure} of ${chargeData.item.name} (${chargeData.categoryLabel})`);
        setIsGlobalChargeOpen(false);
        setGlobalChargeItem(null);
    };

    const handleStockScan = (rawCode: string, targetCategory?: ScannerCategory, parsed?: ParsedScanResult) => {
        const scanData = parsed || parseUniversalScan(rawCode, employees, inventoryItems, targetCategory || 'auto', scannerAction);
        const isKa = t('language') === 'ka' || localStorage.getItem('agri-app-lang') === 'ka';

        // 1. Worker Identification
        if (scanData.detectedType === 'worker' || scanData.employee) {
            const emp = scanData.employee;
            toast.info(isKa ? `✓ თანამშრომელი ამოცნობილია: ${emp?.name || rawCode}` : `✓ Worker identified: ${emp?.name || rawCode}`, {
                description: isKa ? `ID: ${emp?.idNumber || emp?.id}` : `ID: ${emp?.idNumber || emp?.id}`
            });
            return;
        }

        // 2. Material / Agro-input / Goods Scanned
        const mat = scanData.material;
        const item = mat?.item || inventoryItems.find(i => 
            i.id === (mat?.materialId || rawCode) ||
            (i as any).sku === (mat?.sku || rawCode) ||
            (i as any).barcode === (mat?.sku || rawCode) ||
            i.name.toLowerCase() === (mat?.materialName || rawCode).toLowerCase()
        );

        const qty = mat?.quantity || 1;
        const action = mat?.action || scannerAction;
        const nowIso = new Date().toISOString();
        const userName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Administrator';
        const userId = currentUser?.id || 'admin';

        if (action === 'add') {
            // Receive / Add to stock
            if (item) {
                const newStock = Math.round(((item.currentStock || 0) + qty) * 100) / 100;
                const updatedItems = inventoryItems.map(i => i.id === item.id ? { ...i, currentStock: newStock } : i);
                props.onSetInventoryItems(updatedItems);

                const newStockTx: StockTransaction = {
                    id: `tx-stk-add-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    organizationId: '',
                    date: nowIso,
                    itemId: item.id,
                    type: 'ADDITION',
                    quantity: qty,
                    sourceModule: 'MANUAL',
                    reason: `[QR Intake / მიღება] ${mat?.batchId ? 'Batch: ' + mat.batchId : ''} (${mat?.category || 'supplies'})`,
                    chargedByUserId: userId,
                    chargedByUserName: userName,
                    stockBeforeCharge: item.currentStock,
                    stockAfterCharge: newStock,
                    unitOfMeasure: item.unitOfMeasure
                };
                if (props.onSetStockTransactions && props.stockTransactions) {
                    props.onSetStockTransactions([newStockTx, ...props.stockTransactions]);
                }

                toast.success(isKa 
                    ? `✓ მიღებულია საწყობში: +${qty} ${item.unitOfMeasure || 'კგ'} ${item.name}` 
                    : `✓ Received into stock: +${qty} ${item.unitOfMeasure || 'kg'} ${item.name}`);
            } else {
                const newItem: InventoryItem = {
                    id: mat?.materialId || `item-${Date.now()}`,
                    name: mat?.materialName || rawCode,
                    category: (mat?.category === 'assets' ? 'Fixed Assets' : mat?.category === 'goods' ? 'Produce' : 'Fertilizers') as any,
                    currentStock: qty,
                    minStockThreshold: 5,
                    unitCost: 0,
                    unitOfMeasure: mat?.unit || 'kg',
                    supplierId: 'QR_INTAKE'
                };
                props.onSetInventoryItems([...inventoryItems, newItem]);
                toast.success(isKa 
                    ? `✓ ახალი მასალა შეიქმნა და მიიღო: ${newItem.name} (+${qty} ${newItem.unitOfMeasure})` 
                    : `✓ Created & received new item: ${newItem.name} (+${qty} ${newItem.unitOfMeasure})`);
            }
        } else {
            // Charge / Deduct from stock
            if (item) {
                const newStock = Math.max(0, Math.round(((item.currentStock || 0) - qty) * 100) / 100);
                const updatedItems = inventoryItems.map(i => i.id === item.id ? { ...i, currentStock: newStock } : i);
                props.onSetInventoryItems(updatedItems);

                const newStockTx: StockTransaction = {
                    id: `tx-stk-ded-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    organizationId: '',
                    date: nowIso,
                    itemId: item.id,
                    type: 'DEDUCTION',
                    quantity: qty,
                    sourceModule: 'DIRECT_CHARGE',
                    reason: `[QR Direct Charge / ჩამოწერა] ${mat?.batchId ? 'Batch: ' + mat.batchId : ''} (${mat?.category || 'supplies'})`,
                    chargedByUserId: userId,
                    chargedByUserName: userName,
                    stockBeforeCharge: item.currentStock,
                    stockAfterCharge: newStock,
                    unitOfMeasure: item.unitOfMeasure
                };
                if (props.onSetStockTransactions && props.stockTransactions) {
                    props.onSetStockTransactions([newStockTx, ...props.stockTransactions]);
                }

                toast.success(isKa 
                    ? `✓ ჩამოწერილია საწყობიდან: -${qty} ${item.unitOfMeasure || 'კგ'} ${item.name}` 
                    : `✓ Charged from stock: -${qty} ${item.unitOfMeasure || 'kg'} ${item.name}`);
            } else {
                toast.error(isKa ? `მასალა ვერ მოიძებნა საწყობში: ${rawCode}` : `Item not found in stock: ${rawCode}`);
            }
        }
    };

    // Uncategorized items count
    const uncategorizedItems = useMemo(() => {
        return inventoryItems.filter(i => 
            i.category !== 'Produce' && !i.isPrivate && (!i.category || i.category === 'Uncategorized')
        );
    }, [inventoryItems]);

    // Active & Pre-orders count
    const activeOrdersCount = useMemo(() => {
        return (props.purchaseOrders || []).filter(o => o.status === 'Ordered' || o.status === 'Pre-order').length;
    }, [props.purchaseOrders]);

    return (
        <div className="flex-grow space-y-6">
            {/* Master High-Level Section Switcher */}
            <div className="bg-white p-2.5 md:p-3 rounded-[2rem] border border-slate-200/80 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="grid grid-cols-2 lg:flex lg:flex-row gap-1.5 overflow-x-auto scrollbar-hide">
                    {/* 1. Main Stock */}
                    <button
                        type="button"
                        onClick={() => setMainSection('main_stock')}
                        className={`px-4 py-3 rounded-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer ${
                            mainSection === 'main_stock'
                                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-[1.01]'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        <Warehouse className={`w-4 h-4 md:w-5 md:h-5 ${mainSection === 'main_stock' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>{isKa ? 'მთავარი საწყობი' : 'Main Stock & Depots'}</span>
                        {uncategorizedItems.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                                ⚠️ {uncategorizedItems.length}
                            </span>
                        )}
                    </button>

                    {/* 2. Yield Section */}
                    <button
                        type="button"
                        onClick={() => setMainSection('yield')}
                        className={`px-4 py-3 rounded-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer ${
                            mainSection === 'yield'
                                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/10 scale-[1.01]'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        <LeafIcon className={`w-4 h-4 md:w-5 md:h-5 ${mainSection === 'yield' ? 'text-emerald-300' : 'text-emerald-500'}`} />
                        <span>{isKa ? 'მოსავალი & რეალიზაცია' : 'Yield & Harvest'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${mainSection === 'yield' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'}`}>
                            {dashboardStats.produceCount}
                        </span>
                    </button>

                    {/* 3. Orders Section */}
                    <button
                        type="button"
                        onClick={() => setMainSection('orders')}
                        className={`px-4 py-3 rounded-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer ${
                            mainSection === 'orders'
                                ? 'bg-blue-700 text-white shadow-md shadow-blue-700/10 scale-[1.01]'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        <ShoppingBagIcon className={`w-4 h-4 md:w-5 md:h-5 ${mainSection === 'orders' ? 'text-blue-300' : 'text-blue-500'}`} />
                        <span>{isKa ? 'შეკვეთები & ლოჯისტიკა' : 'Orders & Logistics'}</span>
                        {activeOrdersCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${mainSection === 'orders' ? 'bg-blue-800 text-blue-100' : 'bg-blue-100 text-blue-800'}`}>
                                {activeOrdersCount}
                            </span>
                        )}
                    </button>

                    {/* 4. Bureaucracy Section */}
                    <button
                        type="button"
                        onClick={() => setMainSection('bureaucracy')}
                        className={`px-4 py-3 rounded-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer ${
                            mainSection === 'bureaucracy'
                                ? 'bg-violet-700 text-white shadow-md shadow-violet-700/10 scale-[1.01]'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        <Folder className={`w-4 h-4 md:w-5 md:h-5 ${mainSection === 'bureaucracy' ? 'text-violet-300' : 'text-violet-500'}`} />
                        <span>{isKa ? 'ბიუროკრატია & დოკუმენტები' : 'Bureaucracy & Vault'}</span>
                    </button>
                </div>

                {/* Global Utilities Action Group */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end xl:self-auto border-t xl:border-t-0 pt-2 xl:pt-0 border-slate-100">
                    <button
                        type="button"
                        onClick={() => setIsQuickDropOpen(true)}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-amber-200 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                        title={isKa ? "სწრაფი მიღება (უკატეგორიო ინბოქსში ჩაგდება)" : "Quick drop item into uncategorized intake"}
                    >
                        <PackagePlus size={15} />
                        <span className="hidden sm:inline">{isKa ? 'სწრაფი მიღება' : 'Quick Intake'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleOpenTransfer()}
                        className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                        title={isKa ? "საწყობთაშორისი გადატანა" : "Inter-stock transfer"}
                    >
                        <ArrowRightLeft size={15} />
                        <span className="hidden sm:inline">{isKa ? 'გადატანა' : 'Transfer'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setScannerCategory(
                                mainSection === 'yield' ? 'goods' :
                                mainSection === 'main_stock' && mainStockSubTab === 'machinery' ? 'assets' : 'supplies'
                            );
                            setIsScanModalOpen(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                        title={isKa ? "QR / შტრიხკოდის სკანერი (მიღება / ხარჯვა)" : "QR/Barcode scanner"}
                    >
                        <ScanLine size={15} className="text-emerald-400" />
                        <span>{isKa ? 'სკანერი' : 'Scanner'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsQrGenModalOpen(true)}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                        title={isKa ? "QR ეტიკეტების გენერატორი" : "Generate QR Code Labels"}
                    >
                        <QrCode size={15} />
                        <span>QR</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setGoogleSheetsInitialModule(getCurrentSheetModule());
                            setIsGoogleSheetsModalOpen(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-teal-200 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                        title="Sync with Google Sheets"
                    >
                        <FileSpreadsheet size={15} />
                        <span className="hidden md:inline">Sheets</span>
                    </button>
                </div>
            </div>

            {/* SECTION 1: MAIN STOCK & LOCATIONS */}
            {mainSection === 'main_stock' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Main Stock Executive Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatCard 
                            title={isKa ? "საწყობის ღირებულება" : "Portfolio Valuation"} 
                            value={formatCurrency(dashboardStats.totalValue)} 
                            color="text-blue-600" 
                            subtitle={isKa ? "ცენტრალური & ქვესაწყობები" : "Central & Field Depots"}
                            onAddToDashboard={() => onAddToDashboard?.({ type: 'custom_stat', title: 'Stock Valuation', content: formatCurrency(dashboardStats.totalValue) })} 
                        />
                        <StatCard 
                            title={isKa ? "სულ მასალები (SKU)" : "Catalog SKUs"} 
                            value={dashboardStats.itemCount} 
                            color="text-slate-800" 
                            subtitle={isKa ? "აქტიური ნივთები" : "Active stock items"}
                        />
                        <div 
                            onClick={() => {
                                setMainStockSubTab('catalog');
                            }}
                            className={`p-5 rounded-3xl shadow-sm border transition-all cursor-pointer ${
                                uncategorizedItems.length > 0 
                                    ? 'bg-amber-50/80 border-amber-300 hover:border-amber-400 hover:shadow-md' 
                                    : 'bg-white border-slate-100'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {isKa ? "უკატეგორიო ინბოქსი" : "Uncategorized Inbox"}
                                </p>
                                {uncategorizedItems.length > 0 && (
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                    </span>
                                )}
                            </div>
                            <p className={`text-xl md:text-2xl font-black mt-1 ${uncategorizedItems.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                {uncategorizedItems.length}
                            </p>
                            <p className="text-xs font-bold text-amber-700 mt-2 tracking-wide">
                                {uncategorizedItems.length > 0 
                                    ? (isKa ? "საჭიროებს კატეგორიზაციას ➔" : "Pending categorization ➔") 
                                    : (isKa ? "ყველა ნივთი დალაგებულია" : "All items categorized")}
                            </p>
                        </div>
                        <StatCard 
                            title={isKa ? "ქვესაწყობები" : "Sub-Stocks Network"} 
                            value={`${subStocks.length} Depots`} 
                            color="text-indigo-600" 
                            subtitle={isKa ? "დაკავშირებულია მთავართან" : "Linked to Main Stock"}
                        />
                        <StatCard 
                            title={isKa ? "მცირე მარაგი" : "Low Stock Warnings"} 
                            value={dashboardStats.lowStockCount} 
                            color={dashboardStats.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-800'} 
                            subtitle={isKa ? "მინიმალურ ზღვარზე დაბლა" : "Below minimum threshold"}
                        />
                    </div>

                    {/* Main Stock Sub-Navigation Bar */}
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-slate-200 pb-0.5">
                        <button
                            type="button"
                            onClick={() => setMainStockSubTab('catalog')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                mainStockSubTab === 'catalog' 
                                    ? 'bg-white text-slate-900 border-b-4 border-slate-900 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <Box className="w-4 h-4 text-slate-700" />
                            <span>{isKa ? 'ცენტრალური კატალოგი & მასალები' : 'Stock Catalog & Materials'}</span>
                            {uncategorizedItems.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold">
                                    {uncategorizedItems.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setMainStockSubTab('substocks')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                mainStockSubTab === 'substocks' 
                                    ? 'bg-white text-indigo-700 border-b-4 border-indigo-700 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <Warehouse className="w-4 h-4 text-indigo-600" />
                            <span>{isKa ? 'ქვესაწყობების ქსელი & ლოკაციები' : 'Sub-Stocks & Field Depots'}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                                {subStocks.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setMainStockSubTab('charges')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                mainStockSubTab === 'charges' 
                                    ? 'bg-white text-rose-700 border-b-4 border-rose-700 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <Sparkles className="w-4 h-4 text-rose-500" />
                            <span>{isKa ? 'პირდაპირი ჩამოწერები' : 'Direct Charges & Audit'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setMainStockSubTab('machinery')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                mainStockSubTab === 'machinery' 
                                    ? 'bg-white text-amber-700 border-b-4 border-amber-700 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <TractorIcon className="w-4 h-4 text-amber-600" />
                            <span>{isKa ? 'ტექნიკა & აქტივები' : 'Fleet & Machinery Assets'}</span>
                        </button>
                    </div>

                    {/* Main Stock Sub-Views */}
                    <div>
                        {mainStockSubTab === 'catalog' && (
                            <ItemsList 
                                {...props} 
                                subStocks={subStocks}
                                customCategories={customCategories}
                                onAddCustomCategory={handleAddCustomCategory}
                                onOpenTransfer={handleOpenTransfer}
                                onOpenQuickDrop={() => setIsQuickDropOpen(true)}
                                preselectedLocation={catalogLocationFilter}
                                onOpenDirectCharge={(item) => { 
                                    setGlobalChargeItem(item); 
                                    setIsGlobalChargeOpen(true); 
                                }} 
                            />
                        )}

                        {mainStockSubTab === 'substocks' && (
                            <SubStocksManager
                                subStocks={subStocks}
                                onSetSubStocks={setSubStocks}
                                inventoryItems={inventoryItems}
                                onOpenTransfer={(sourceId) => handleOpenTransfer(undefined, sourceId)}
                                onFilterByLocation={(locId) => {
                                    setCatalogLocationFilter(locId);
                                    setMainStockSubTab('catalog');
                                }}
                            />
                        )}

                        {mainStockSubTab === 'charges' && (
                            <DirectChargesAuditList 
                                {...props} 
                                onOpenChargeModal={(item) => {
                                    setGlobalChargeItem(item || null);
                                    setIsGlobalChargeOpen(true);
                                }} 
                            />
                        )}

                        {mainStockSubTab === 'machinery' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setMachinerySubTab('fleet')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                            machinerySubTab === 'fleet' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <TractorIcon className="w-4 h-4 text-amber-500" />
                                        <span>Fleet & Machinery Master</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMachinerySubTab('stock')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                            machinerySubTab === 'stock' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <TagIcon className="w-4 h-4 text-blue-500" />
                                        <span>Asset Inventory Catalog</span>
                                    </button>
                                </div>

                                {machinerySubTab === 'fleet' ? (
                                    <MachineryManager 
                                        machinery={props.machinery || []}
                                        onSetMachinery={props.onSetMachinery || (() => {})}
                                        currentUserPermissions={props.currentUserPermissions}
                                        employees={props.employees || []}
                                    />
                                ) : (
                                    <ItemsList 
                                        {...props} 
                                        filterCategories={STOCK_CATEGORY_GROUPS.machinery} 
                                        subStocks={subStocks}
                                        customCategories={customCategories}
                                        onAddCustomCategory={handleAddCustomCategory}
                                        onOpenTransfer={handleOpenTransfer}
                                        onOpenQuickDrop={() => setIsQuickDropOpen(true)}
                                        onOpenDirectCharge={(item) => { 
                                            setGlobalChargeItem(item); 
                                            setIsGlobalChargeOpen(true); 
                                        }} 
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SECTION 2: YIELD & HARVEST */}
            {mainSection === 'yield' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Sector Analysis & Yield Stat Cards */}
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                                    {isKa ? 'სექტორის ანალიზი & მოსავალი' : 'Sector Analysis & Yield Valuation'}
                                </h3>
                                <p className="text-xs font-bold text-slate-500">
                                    {isKa ? 'ფილტრაცია პლანტაციის სექტორების მიხედვით' : 'Filter yield metrics and harvest lots by plantation sector'}
                                </p>
                            </div>
                            <select
                                value={selectedSectorId}
                                onChange={(e) => setSelectedSectorId(e.target.value)}
                                className="bg-white border border-slate-200 text-xs font-black uppercase tracking-wider rounded-xl px-4 py-2.5 shadow-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors cursor-pointer"
                            >
                                <option value="all">All Sectors / ყველა სექტორი</option>
                                {sectors.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            <StatCard 
                                title="Public Yield Value" 
                                value={formatCurrency(publicYieldValue)} 
                                color="text-emerald-600" 
                                subtitle="მოსავლიდან შემოსული თანხები"
                            />
                            <StatCard 
                                title="Harvest Opex" 
                                value={formatCurrency(totalHarvestOpex)} 
                                color="text-red-600" 
                                subtitle="მოსავლის ხარჯები"
                            />
                            <StatCard 
                                title="Deposits on LLC" 
                                value={formatCurrency(totalDepositsOnLLC)} 
                                color="text-blue-600" 
                                subtitle="შპს-ზე ჩარიცხვები"
                            />
                            <StatCard 
                                title="Cash Deposits" 
                                value={formatCurrency(totalCashDeposits)} 
                                color="text-slate-800" 
                                subtitle="ქეში ჩარიცხვები"
                            />
                            <StatCard 
                                title="Weighted Avg Price / 1 KG" 
                                value={`${formatCurrency(weightedAveragePrice)} / kg`} 
                                color="text-indigo-600" 
                                subtitle="საშუალო ფასი 1 კგ-ზე"
                            />
                        </div>
                    </div>

                    {/* Yield Sub-Navigation */}
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-slate-200 pb-0.5">
                        <button
                            type="button"
                            onClick={() => setYieldSubTab('produce')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                yieldSubTab === 'produce' 
                                    ? 'bg-white text-emerald-700 border-b-4 border-emerald-600 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <LeafIcon className="h-4 w-4 text-emerald-500"/>
                            <span>{t('stock.tab.produce') || "Harvested Produce"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setYieldSubTab('sales')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                yieldSubTab === 'sales' 
                                    ? 'bg-white text-emerald-700 border-b-4 border-emerald-600 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <BanknotesIcon className="h-4 w-4 text-emerald-500"/>
                            <span>{isKa ? 'რეალიზაცია & გაყიდვები' : 'Sales & Commercial'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setYieldSubTab('refrigerator')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                yieldSubTab === 'refrigerator' 
                                    ? 'bg-white text-sky-700 border-b-4 border-sky-600 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <Snowflake className="h-4 w-4 text-sky-500"/>
                            <span>{t('stock.tab.refrigerator') || "Cold Storage Refrigerator"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setYieldSubTab('archive')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                yieldSubTab === 'archive' 
                                    ? 'bg-white text-slate-800 border-b-4 border-slate-800 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <TagIcon className="h-4 w-4"/>
                            <span>{t('stock.tab.archive') || "Post-Harvest Archive"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setYieldSubTab('ledger')}
                            className={`px-4 py-2.5 rounded-t-2xl text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                                yieldSubTab === 'ledger' 
                                    ? 'bg-white text-indigo-700 border-b-4 border-indigo-600 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <DocumentTextIcon className="h-4 w-4"/>
                            <span>{t('stock.tab.ledger') || "Live Yield Ledger"}</span>
                        </button>
                    </div>

                    {/* Yield Content */}
                    <div>
                        {yieldSubTab === 'produce' && <HarvestProduceList {...props} />}
                        {yieldSubTab === 'sales' && <HarvestSalesList {...props} />}
                        {yieldSubTab === 'refrigerator' && (
                            <RefrigeratorView 
                                inventoryItems={inventoryItems} 
                                onSetInventoryItems={props.onSetInventoryItems} 
                                accounts={props.accounts} 
                                onSetAccounts={props.onSetAccounts}
                                transactions={props.transactions}
                                onSetTransactions={props.onSetTransactions}
                            />
                        )}
                        {yieldSubTab === 'archive' && <HarvestArchiveList {...props} />}
                        {yieldSubTab === 'ledger' && <LiveStockLedger {...props} />}
                    </div>
                </div>
            )}

            {/* SECTION 3: ORDERS & PROCUREMENT */}
            {mainSection === 'orders' && (
                <div className="space-y-6 animate-fade-in">
                    <OrdersSection 
                        purchaseOrders={props.purchaseOrders || []}
                        onSetPurchaseOrders={props.onSetPurchaseOrders}
                        suppliers={props.suppliers || []}
                        onSetSuppliers={props.onSetSuppliers}
                        inventoryItems={inventoryItems}
                        onSetInventoryItems={props.onSetInventoryItems}
                        stockTransactions={props.stockTransactions}
                        onSetStockTransactions={props.onSetStockTransactions}
                        subStocks={subStocks}
                        currentUserPermissions={currentUserPermissions}
                    />
                </div>
            )}

            {/* SECTION 4: BUREAUCRACY & DOCUMENTS */}
            {mainSection === 'bureaucracy' && (
                <div className="space-y-6 animate-fade-in">
                    <BureaucracySection 
                        sectors={props.plantationFeatures?.filter((f: any) => f.type === 'area' || f.type === 'sector') as any} 
                        inventoryItems={props.inventoryItems} 
                        currentUser={currentUser} 
                    />
                </div>
            )}

            {/* Quick Add Uncategorized Modal */}
            {isQuickDropOpen && (
                <QuickAddUncategorizedModal
                    isOpen={isQuickDropOpen}
                    onClose={() => setIsQuickDropOpen(false)}
                    subStocks={subStocks}
                    onSaveItem={(newItem) => {
                        props.onSetInventoryItems([newItem, ...inventoryItems]);
                        setIsQuickDropOpen(false);
                        toast.success(isKa ? `✓ ნივთი მიღებულია: ${newItem.name} (უკატეგორიო ინბოქსში)` : `✓ Item added: ${newItem.name} (uncategorized inbox)`);
                    }}
                />
            )}

            {/* Inter-Stock Transfer Modal */}
            {isTransferModalOpen && (
                <StockTransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => {
                        setIsTransferModalOpen(false);
                        setTransferPreselectedItemId(undefined);
                    }}
                    inventoryItems={inventoryItems}
                    onSetInventoryItems={props.onSetInventoryItems}
                    subStocks={subStocks}
                    stockTransactions={props.stockTransactions}
                    onSetStockTransactions={props.onSetStockTransactions}
                    preselectedItemId={transferPreselectedItemId}
                    preselectedSourceId={transferPreselectedSourceId}
                />
            )}

            {isGlobalChargeOpen && (
                <DirectStockChargeModal
                    isOpen={isGlobalChargeOpen}
                    onClose={() => {
                        setIsGlobalChargeOpen(false);
                        setGlobalChargeItem(null);
                    }}
                    preselectedItem={globalChargeItem}
                    inventoryItems={inventoryItems}
                    employees={props.employees}
                    currentUser={currentUser}
                    onConfirmCharge={handleExecuteDirectCharge}
                />
            )}

            {isGoogleSheetsModalOpen && (
                <GoogleSheetsModal
                    isOpen={isGoogleSheetsModalOpen}
                    onClose={() => setIsGoogleSheetsModalOpen(false)}
                    initialModule={googleSheetsInitialModule}
                    inventoryItems={props.inventoryItems}
                    onSetInventoryItems={props.onSetInventoryItems}
                    harvestEvents={props.harvestEvents}
                    stockTransactions={props.stockTransactions}
                    onSetStockTransactions={props.onSetStockTransactions}
                    suppliers={props.suppliers}
                    onSetSuppliers={props.onSetSuppliers}
                    purchaseOrders={props.purchaseOrders}
                    onSetPurchaseOrders={props.onSetPurchaseOrders}
                    machinery={props.machinery}
                    employees={props.employees}
                    onSetEmployees={props.onSetEmployees}
                    accounts={props.accounts}
                    transactions={props.transactions}
                    onSetTransactions={props.onSetTransactions}
                    currentUser={props.currentUser}
                />
            )}

            {/* Stock Universal QR & Barcode Scanner */}
            {isScanModalOpen && (
                <QrScannerModal
                    isOpen={isScanModalOpen}
                    onClose={() => setIsScanModalOpen(false)}
                    onScan={handleStockScan}
                    initialCategory={scannerCategory}
                    initialAction={scannerAction}
                    mockEmployees={employees}
                    inventoryItems={inventoryItems}
                    onOpenGenerator={() => setIsQrGenModalOpen(true)}
                    title={t('language') === 'ka' ? "საწყობის QR / შტრიხკოდის სკანერი" : "Stock QR & Barcode Scanner"}
                    description={t('language') === 'ka' ? "მიიღეთ ან ჩამოწერეთ მასალები, სასუქები, აქტივები და მოსავალი" : "Receive or charge supplies, agro-inputs, assets and produce"}
                />
            )}

            {/* Material & Agro-input Batch QR Generator */}
            {isQrGenModalOpen && (
                <MaterialQrGeneratorModal
                    isOpen={isQrGenModalOpen}
                    onClose={() => setIsQrGenModalOpen(false)}
                    inventoryItems={inventoryItems}
                    defaultCategory={scannerCategory === 'assets' ? 'assets' : scannerCategory === 'goods' ? 'goods' : 'supplies'}
                />
            )}
        </div>
    );
};

interface ItemsListProps extends StockViewProps {
    filterCategories?: string[];
    onOpenDirectCharge?: (item: InventoryItem) => void;
    subStocks?: SubStock[];
    customCategories?: string[];
    onAddCustomCategory?: (cat: string) => void;
    onOpenTransfer?: (itemId?: string, sourceId?: string) => void;
    onOpenQuickDrop?: () => void;
    preselectedLocation?: string;
}

const ItemsList: React.FC<ItemsListProps> = (props) => {
    const { formatCurrency, language } = useLanguage();
    const isKa = language === 'ka';
    const { 
        inventoryItems = [], 
        onSetInventoryItems, 
        filterCategories, 
        onOpenDirectCharge,
        subStocks = [],
        customCategories = [],
        onAddCustomCategory,
        onOpenTransfer,
        onOpenQuickDrop,
        preselectedLocation = 'all'
    } = props;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
    const [chargeItem, setChargeItem] = useState<InventoryItem | null>(null);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Category & Location Tabs
    const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
    const [selectedLocation, setSelectedLocation] = useState<string>(preselectedLocation);
    const [showNewCatModal, setShowNewCatModal] = useState(false);
    const [newCatInput, setNewCatInput] = useState('');

    // Categorization counts
    const uncategorizedItems = useMemo(() => {
        return inventoryItems.filter(i => 
            i.category !== 'Produce' && !i.isPrivate && (!i.category || i.category === 'Uncategorized')
        );
    }, [inventoryItems]);

    const filteredItems = useMemo(() => {
        let items = inventoryItems.filter(i => i.category !== 'Produce' && !i.isPrivate && !i.relatedHarvestId);

        // Location Filter
        if (selectedLocation === 'main') {
            items = items.filter(i => !i.subStockId);
        } else if (selectedLocation !== 'all') {
            items = items.filter(i => i.subStockId === selectedLocation);
        }

        // Category Tab Filter
        if (selectedCategoryTab === 'Uncategorized') {
            items = items.filter(i => !i.category || i.category === 'Uncategorized');
        } else if (selectedCategoryTab === 'agroinputs') {
            items = items.filter(i => STOCK_CATEGORY_GROUPS.agroinputs.includes(i.category as any));
        } else if (selectedCategoryTab === 'packaging') {
            items = items.filter(i => ['Packaging', 'Pallets'].includes(i.category));
        } else if (selectedCategoryTab === 'fuel') {
            items = items.filter(i => i.category === 'Fuel');
        } else if (selectedCategoryTab === 'tools') {
            items = items.filter(i => ['Tools', 'Fixed Assets', 'Machinery'].includes(i.category));
        } else if (selectedCategoryTab === 'parts') {
            items = items.filter(i => ['Spare Parts', 'Construction', 'Consumables'].includes(i.category));
        } else if (selectedCategoryTab === 'Other') {
            items = items.filter(i => i.category === 'Other');
        } else if (selectedCategoryTab !== 'all') {
            items = items.filter(i => i.category === selectedCategoryTab);
        } else if (filterCategories?.length) {
            items = items.filter(i => filterCategories.includes(i.category));
        }

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(i => 
                i.name.toLowerCase().includes(q) || 
                i.sku?.toLowerCase().includes(q) || 
                i.category.toLowerCase().includes(q) ||
                (i.subStockName && i.subStockName.toLowerCase().includes(q)) ||
                (i.location && i.location.toLowerCase().includes(q))
            );
        }
        return items;
    }, [inventoryItems, searchQuery, filterCategories, selectedCategoryTab, selectedLocation]);

    const handleQuickCategorize = (itemId: string, newCategory: string) => {
        if (!newCategory) return;
        const updated = inventoryItems.map(i => i.id === itemId ? { ...i, category: newCategory as any } : i);
        onSetInventoryItems(updated);
        toast.success(isKa ? `ნივთს მიენიჭა კატეგორია: ${newCategory}` : `Categorized as: ${newCategory}`);
    };

    const handleDeleteItem = (itemId: string, itemName: string) => {
        if (confirm(isKa ? `დარწმუნებული ხართ, რომ გსურთ "${itemName}"-ის წაშლა?` : `Are you sure you want to delete "${itemName}"?`)) {
            onSetInventoryItems(inventoryItems.filter(i => i.id !== itemId));
            toast.info(isKa ? 'ნივთი წაიშალა მარაგებიდან' : 'Item removed from stock');
        }
    };

    const handleExport = () => {
        const headers = ["Registry Registry", "SKU", "Category", "Current Stock (PKGS)", "Unit", "Total Mass/Vol", "Unit Vol/Size", "Unit Cost", "Portfolio Value"];
        const rows = filteredItems.map(item => [
            `"${item.name}"`,
            item.sku || 'N/A',
            item.category,
            item.currentStock,
            item.unitOfMeasure,
            item.packageContent ? (item.currentStock * item.packageContent).toFixed(2) : item.currentStock,
            item.packageContent || 'N/A',
            item.unitCost,
            (item.currentStock * item.unitCost).toFixed(2)
        ]);
        
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `inventory_registry_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleConfirmDirectCharge = (chargeData: DirectStockChargeData) => {
        const updatedItems = inventoryItems.map(i => {
            if (i.id === chargeData.itemId) {
                const newStock = Math.round((i.currentStock - chargeData.deductedStockAmount) * 100) / 100;
                return { ...i, currentStock: newStock };
            }
            return i;
        });
        onSetInventoryItems(updatedItems);

        const newStockTx: StockTransaction = {
            id: `tx-stk-chg-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
            organizationId: '',
            date: chargeData.date,
            itemId: chargeData.itemId,
            type: 'DEDUCTION',
            quantity: chargeData.deductedStockAmount,
            sourceModule: 'DIRECT_CHARGE',
            reason: `[${chargeData.categoryLabel}] ${chargeData.note}`,
            chargeCategory: chargeData.chargeCategory,
            chargedByUserId: chargeData.chargedByUserId,
            chargedByUserName: chargeData.chargedByUserName,
            responsibleEmployeeId: chargeData.responsibleEmployeeId,
            responsibleEmployeeName: chargeData.responsibleEmployeeName,
            note: chargeData.note,
            unitPriceAtCharge: chargeData.unitPriceAtCharge,
            totalCostCharged: chargeData.totalCostCharged,
            stockBeforeCharge: chargeData.stockBeforeCharge,
            stockAfterCharge: chargeData.stockAfterCharge,
            unitOfMeasure: chargeData.item.unitOfMeasure,
            packageQuantityCharged: chargeData.equivalentPackages,
            massVolumeCharged: chargeData.equivalentMassVolume
        };

        if (props.onSetStockTransactions && props.stockTransactions) {
            props.onSetStockTransactions([newStockTx, ...props.stockTransactions]);
        }

        const newInvTx: InventoryTransaction = {
            id: `tx-inv-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
            itemId: chargeData.itemId,
            date: chargeData.date,
            type: 'out',
            quantity: chargeData.deductedStockAmount,
            reason: `[Direct Charge - ${chargeData.categoryLabel}] ${chargeData.note}`,
            chargedByUserName: chargeData.chargedByUserName,
            chargedByUserId: chargeData.chargedByUserId,
            chargeCategory: chargeData.chargeCategory,
            note: chargeData.note,
            totalCost: chargeData.totalCostCharged
        };

        if (props.onSetInventoryTransactions && props.inventoryTransactions) {
            props.onSetInventoryTransactions([newInvTx, ...props.inventoryTransactions]);
        }

        toast.success(`Direct Charge logged: -${chargeData.deductedStockAmount} ${chargeData.item.unitOfMeasure} of ${chargeData.item.name} (${chargeData.categoryLabel})`);
        setIsChargeModalOpen(false);
        setChargeItem(null);
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden space-y-5">
            {/* Top Toolbar */}
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                    <div className="relative flex-grow max-w-md">
                        <SearchIcon className="h-5 w-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"/>
                        <input 
                            type="text" 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            placeholder={isKa ? "ძიება დასახელებით, SKU, საწყობით..." : "Filter inventory, SKU, sub-stock..."} 
                            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200/60 rounded-2xl font-bold text-xs outline-none focus:bg-white focus:border-blue-500 transition-all" 
                        />
                    </div>

                    {/* Location Selector */}
                    <div className="flex items-center gap-2">
                        <Warehouse className="w-4 h-4 text-slate-500 shrink-0" />
                        <select
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 text-slate-800 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <option value="all">{isKa ? 'ყველა ლოკაცია' : 'All Warehouses'}</option>
                            <option value="main">{isKa ? 'მთავარი ცენტრალური საწყობი' : 'Main Central Warehouse'}</option>
                            {subStocks.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {onOpenQuickDrop && (
                        <button 
                            type="button"
                            onClick={onOpenQuickDrop}
                            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm shadow-amber-200 hover:scale-[1.02] active:scale-95 cursor-pointer"
                            title={isKa ? "სწრაფი მიღება დალაგებამდე (უკატეგორიო ნივთი)" : "Quick drop item before categorization"}
                        >
                            <PackagePlus className="h-4 w-4" />
                            <span>{isKa ? 'სწრაფი მიღება' : 'Quick Drop'}</span>
                        </button>
                    )}

                    {onOpenTransfer && (
                        <button 
                            type="button"
                            onClick={() => onOpenTransfer()}
                            className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 border border-blue-200 cursor-pointer"
                            title={isKa ? "საწყობთაშორისი გადატანა" : "Inter-warehouse stock transfer"}
                        >
                            <ArrowRightLeft className="h-4 w-4" />
                            <span>{isKa ? 'გადატანა' : 'Transfer'}</span>
                        </button>
                    )}

                    <button 
                        type="button"
                        onClick={() => { setChargeItem(null); setIsChargeModalOpen(true); }} 
                        className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 border border-rose-200 cursor-pointer"
                        title={isKa ? "პირდაპირი ჩამოწერა / ხარჯვა" : "Charge or write off item directly from stock"}
                    >
                        <Sparkles className="h-4 w-4 text-rose-600" />
                        <span>{isKa ? 'ჩამოწერა' : 'Charge'}</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setIsMergeModalOpen(true)} 
                        className="px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-100 transition-all flex items-center gap-1.5 border border-indigo-200 cursor-pointer"
                    >
                        <ArrowsRightLeftIcon className="h-4 w-4" />
                        <span>{isKa ? 'გაერთიანება' : 'Merge'}</span>
                    </button>

                    <button 
                        type="button"
                        onClick={handleExport} 
                        className="px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-100 transition-all flex items-center gap-1.5 border border-emerald-200 cursor-pointer"
                    >
                        <DocumentTextIcon className="h-4 w-4" />
                        <span>Excel</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }} 
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                        <span>{isKa ? '+ ნივთის დამატება' : '+ Add Item'}</span>
                    </button>
                </div>
            </div>

            {/* Category Filter Pills Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide pt-1 border-t border-slate-100">
                <button
                    type="button"
                    onClick={() => setSelectedCategoryTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategoryTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    {isKa ? 'ყველა ნივთი' : 'All Items'}
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedCategoryTab('Uncategorized')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        selectedCategoryTab === 'Uncategorized' 
                            ? 'bg-amber-600 text-white shadow-sm' 
                            : uncategorizedItems.length > 0 
                                ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' 
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>⚠️ {isKa ? 'უკატეგორიო' : 'Uncategorized'}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        selectedCategoryTab === 'Uncategorized' ? 'bg-amber-800 text-amber-100' : 'bg-amber-200 text-amber-900'
                    }`}>
                        {uncategorizedItems.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedCategoryTab('agroinputs')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategoryTab === 'agroinputs' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    🌱 {isKa ? 'აგროინპუტები' : 'Agro-Inputs'}
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedCategoryTab('packaging')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategoryTab === 'packaging' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    📦 {isKa ? 'ტარა & შეფუთვა' : 'Packaging & Crates'}
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedCategoryTab('tools')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategoryTab === 'tools' ? 'bg-violet-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    🔧 {isKa ? 'ხელსაწყოები & ტექნიკა' : 'Tools & Equipment'}
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedCategoryTab('parts')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategoryTab === 'parts' ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    ⚙️ {isKa ? 'სათადარიგო ნაწილები' : 'Spare Parts'}
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedCategoryTab('fuel')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategoryTab === 'fuel' ? 'bg-amber-700 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    ⛽ {isKa ? 'საწვავი' : 'Fuel'}
                </button>

                {customCategories.map(cat => (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategoryTab(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                            selectedCategoryTab === cat ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                        }`}
                    >
                        🏷️ {cat}
                    </button>
                ))}

                <button
                    type="button"
                    onClick={() => setShowNewCatModal(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                    <PlusCircleIcon className="w-3.5 h-3.5" />
                    <span>{isKa ? 'ახალი კატეგორია' : 'New Category'}</span>
                </button>
            </div>

            {/* Custom Category Quick Add Modal */}
            {showNewCatModal && (
                <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 flex items-center gap-2">
                    <input
                        type="text"
                        value={newCatInput}
                        onChange={(e) => setNewCatInput(e.target.value)}
                        placeholder={isKa ? 'შეიყვანეთ ახალი კატეგორიის სახელი...' : 'Enter custom category name...'}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (newCatInput.trim()) {
                                onAddCustomCategory?.(newCatInput.trim());
                                setSelectedCategoryTab(newCatInput.trim());
                                setNewCatInput('');
                                setShowNewCatModal(false);
                            }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                        {isKa ? 'შენახვა' : 'Save'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowNewCatModal(false)}
                        className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
                    >
                        {isKa ? 'გაუქმება' : 'Cancel'}
                    </button>
                </div>
            )}

            <div className="overflow-x-auto -mx-4 md:-mx-6">
                <div className="inline-block min-w-full align-middle px-4 md:px-6">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                            <tr>
                                <th className="px-6 py-4">{isKa ? 'ნივთი / SKU' : 'Registry / SKU'}</th>
                                <th className="px-6 py-4">{isKa ? 'ლოკაცია / საწყობი' : 'Warehouse Location'}</th>
                                <th className="px-6 py-4">{isKa ? 'კატეგორია' : 'Category'}</th>
                                <th className="px-6 py-4 text-right">{isKa ? 'ნაშთი (PKGS)' : 'Current Stock (PKGS)'}</th>
                                <th className="px-6 py-4 text-right">{isKa ? 'მასა / მოცულობა' : 'Total Mass/Vol'}</th>
                                <th className="px-6 py-4 text-right">{isKa ? 'ღირებულება' : 'Portfolio Val.'}</th>
                                <th className="px-6 py-4 text-right">{isKa ? 'მოქმედებები' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredItems.map(item => {
                                const isUncat = !item.category || item.category === 'Uncategorized';
                                const locationLabel = item.subStockName || item.location || (isKa ? 'მთავარი საწყობი' : 'Main Warehouse');

                                return (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-mono uppercase">{item.sku || 'No SKU'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black rounded-lg bg-slate-100 text-slate-700">
                                                <Warehouse className="w-3 h-3 text-slate-500" />
                                                {locationLabel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {isUncat ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-2 py-0.5 text-[9px] font-black bg-amber-100 text-amber-800 rounded-md uppercase">
                                                        ⚠️ {isKa ? 'უკატეგორიო' : 'Pending'}
                                                    </span>
                                                    <select
                                                        onChange={(e) => handleQuickCategorize(item.id, e.target.value)}
                                                        className="text-[10px] font-bold bg-white border border-amber-300 text-amber-900 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-amber-50"
                                                        defaultValue=""
                                                    >
                                                        <option value="" disabled>{isKa ? 'მიანიჭეთ კატეგორია...' : 'Assign Category...'}</option>
                                                        <option value="Fertilizers">🌱 {isKa ? 'სასუქები' : 'Fertilizers'}</option>
                                                        <option value="Pesticides">🛡️ {isKa ? 'პესტიციდები' : 'Pesticides'}</option>
                                                        <option value="Packaging">📦 {isKa ? 'ტარა / ყუთები' : 'Packaging'}</option>
                                                        <option value="Tools">🔧 {isKa ? 'ხელსაწყოები' : 'Tools'}</option>
                                                        <option value="Spare Parts">⚙️ {isKa ? 'ნაწილები' : 'Spare Parts'}</option>
                                                        <option value="Fuel">⛽ {isKa ? 'საწვავი' : 'Fuel'}</option>
                                                        <option value="Consumables">🧻 {isKa ? 'სახარჯი' : 'Consumables'}</option>
                                                        {customCategories.map(c => (
                                                            <option key={c} value={c}>🏷️ {c}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <span className="px-2.5 py-1 text-[9px] font-black bg-blue-100 text-blue-700 rounded-lg uppercase">
                                                    {item.category}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap font-black">
                                            <div className="flex items-center justify-end gap-2">
                                                {item.currentStock < (item.minStockThreshold || 0) && (
                                                    <span className="text-[8px] uppercase tracking-widest bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Low Stock</span>
                                                )}
                                                <span className={item.currentStock < (item.minStockThreshold || 0) ? 'text-red-600 font-black' : 'text-slate-900 font-bold'}>
                                                    {item.currentStock.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{item.unitOfMeasure}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <div className="font-black text-indigo-600">
                                                {item.packageContent ? (item.currentStock * item.packageContent).toLocaleString() : item.currentStock.toLocaleString()}
                                                <span className="text-[9px] ml-1 uppercase">{item.packageContentUnit || item.unitOfMeasure}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap font-black text-slate-700">
                                            {formatCurrency(item.currentStock * item.unitCost)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-1.5">
                                                {onOpenTransfer && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => onOpenTransfer(item.id, item.subStockId || 'main')} 
                                                        title={isKa ? "საწყობთაშორისი გადატანა" : "Transfer between warehouses"} 
                                                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all cursor-pointer"
                                                    >
                                                        <ArrowRightLeft className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button 
                                                    type="button"
                                                    onClick={() => { setChargeItem(item); setIsChargeModalOpen(true); }} 
                                                    title={isKa ? "⚡ პირდაპირი ჩამოწერა მარაგებიდან" : "⚡ Charge Directly From Stock (ჩამოწერა)"} 
                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => { setHistoryItem(item); setIsHistoryModalOpen(true); }} 
                                                    title="View Item Transaction History & Audits" 
                                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all cursor-pointer"
                                                >
                                                    <DocumentTextIcon className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => { setEditingItem(item); setIsModalOpen(true); }} 
                                                    title="Edit Item"
                                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
                                                >
                                                    <PencilSquareIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteItem(item.id, item.name)}
                                                    title="Delete Item"
                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition-all cursor-pointer"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        <Box className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        <p>{isKa ? 'ნივთები არ მოიძებნა არჩეულ კრიტერიუმებზე' : 'No inventory items found matching selection'}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {isModalOpen && <StockItemModal 
                item={editingItem} 
                subStocks={subStocks}
                customCategories={customCategories}
                onAddCustomCategory={onAddCustomCategory}
                onSave={(data) => {
                    let diff = 0;
                    if (editingItem) {
                        diff = data.currentStock - editingItem.currentStock;
                        onSetInventoryItems(inventoryItems.map(i => i.id === data.id ? data : i));
                    } else {
                        diff = data.currentStock;
                        onSetInventoryItems([...inventoryItems, { ...data, id: `item-${Date.now()}` }]);
                    }
                    
                    if (diff !== 0 && props.onSetStockTransactions && props.stockTransactions) {
                        props.onSetStockTransactions([...props.stockTransactions, {
                            id: `tx-stk-${Date.now()}`,
                            organizationId: '',
                            date: new Date().toISOString(),
                            itemId: editingItem ? data.id : `item-${Date.now()}`,
                            type: diff > 0 ? 'ADDITION' : 'DEDUCTION',
                            quantity: Math.abs(diff),
                            sourceModule: 'MANUAL',
                            reason: editingItem ? 'Manual balance adjustment via directory edit' : 'Initial stock entry'
                        }]);
                    }

                    setIsModalOpen(false);
                }} 
                onClose={() => setIsModalOpen(false)}
            />}
            {isMergeModalOpen && (
                <MergeItemsModal
                    isOpen={isMergeModalOpen}
                    onClose={() => setIsMergeModalOpen(false)}
                    inventoryItems={props.inventoryItems || []}
                    onSetInventoryItems={props.onSetInventoryItems}
                    stockTransactions={props.stockTransactions}
                    onSetStockTransactions={props.onSetStockTransactions}
                    inventoryTransactions={props.inventoryTransactions}
                    onSetInventoryTransactions={props.onSetInventoryTransactions}
                    purchaseOrders={props.purchaseOrders}
                    onSetPurchaseOrders={props.onSetPurchaseOrders}
                />
            )}
            {isChargeModalOpen && (
                <DirectStockChargeModal
                    isOpen={isChargeModalOpen}
                    onClose={() => { setIsChargeModalOpen(false); setChargeItem(null); }}
                    preselectedItem={chargeItem}
                    inventoryItems={inventoryItems}
                    employees={props.employees}
                    currentUser={props.currentUser}
                    onConfirmCharge={handleConfirmDirectCharge}
                />
            )}
            {isHistoryModalOpen && historyItem && (
                <ItemHistoryModal
                    isOpen={isHistoryModalOpen}
                    onClose={() => { setIsHistoryModalOpen(false); setHistoryItem(null); }}
                    item={historyItem}
                    transactions={props.inventoryTransactions || []}
                    workAssignments={props.workAssignments || []}
                    purchaseOrders={props.purchaseOrders || []}
                    stockTransactions={props.stockTransactions || []}
                    onRestoreStockVersion={async (restoredStock: number, reason: string, revertedTxId?: string) => {
                        const previousStock = historyItem.currentStock;
                        const diff = Math.round((restoredStock - previousStock) * 100) / 100;
                        
                        // 1. Update item stock in inventory list
                        const updated = inventoryItems.map(i => i.id === historyItem.id ? { ...i, currentStock: restoredStock } : i);
                        props.onSetInventoryItems(updated);
                        setHistoryItem(prev => prev ? { ...prev, currentStock: restoredStock } : null);

                        // 2. Add StockTransaction
                        if (props.onSetStockTransactions && props.stockTransactions) {
                            const newStockTx: StockTransaction = {
                                id: `tx-stk-rst-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                                organizationId: '',
                                date: new Date().toISOString(),
                                itemId: historyItem.id,
                                type: diff >= 0 ? 'REFUND' : 'DEDUCTION',
                                quantity: Math.abs(diff),
                                sourceModule: 'MANUAL',
                                referenceId: revertedTxId,
                                reason: reason || `Version Restore from ${previousStock} to ${restoredStock}`,
                                chargeCategory: 'INVENTORY_AUDIT_ADJUSTMENT',
                                chargedByUserId: props.currentUser?.id,
                                chargedByUserName: props.currentUser?.name || 'Administrator',
                                stockBeforeCharge: previousStock,
                                stockAfterCharge: restoredStock,
                                unitOfMeasure: historyItem.unitOfMeasure
                            };
                            props.onSetStockTransactions([newStockTx, ...props.stockTransactions]);
                        }

                        // 3. Add InventoryTransaction
                        if (props.onSetInventoryTransactions && props.inventoryTransactions) {
                            const newInvTx: InventoryTransaction = {
                                id: `tx-inv-rst-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                                itemId: historyItem.id,
                                date: new Date().toISOString(),
                                type: 'adjustment',
                                quantity: Math.abs(diff),
                                reason: reason || `Version Restored: ${previousStock} -> ${restoredStock}`,
                                chargedByUserName: props.currentUser?.name || 'Administrator',
                                chargedByUserId: props.currentUser?.id,
                                chargeCategory: 'INVENTORY_AUDIT_ADJUSTMENT',
                                note: `Reverted Tx: ${revertedTxId || 'Manual point-in-time restore'}`
                            };
                            props.onSetInventoryTransactions([newInvTx, ...props.inventoryTransactions]);
                        }
                    }}
                />
            )}
        </div>
    );
};

const DirectChargesAuditList: React.FC<StockViewProps & { onOpenChargeModal?: (item?: InventoryItem | null) => void }> = (props) => {
    const { stockTransactions = [], inventoryItems = [], onOpenChargeModal } = props;
    const { formatCurrency } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const pageSize = 40;

    const inventoryMap = useMemo(() => {
        return new Map((inventoryItems || []).map(i => [i.id, i]));
    }, [inventoryItems]);

    // All direct write-off transactions
    const directCharges = useMemo(() => {
        return stockTransactions
            .filter(tx => tx.sourceModule === 'DIRECT_CHARGE' || tx.chargeCategory || (tx.reason && (tx.reason.includes('[') || tx.reason.toLowerCase().includes('direct') || tx.reason.toLowerCase().includes('charge'))))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [stockTransactions]);

    const filteredCharges = useMemo(() => {
        return directCharges.filter(tx => {
            if (selectedCategoryFilter !== 'all' && tx.chargeCategory !== selectedCategoryFilter) {
                return false;
            }
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const item = inventoryMap.get(tx.itemId);
                const itemName = item?.name?.toLowerCase() || '';
                const itemSku = item?.sku?.toLowerCase() || '';
                const reason = tx.reason?.toLowerCase() || '';
                const note = tx.note?.toLowerCase() || '';
                const user = tx.chargedByUserName?.toLowerCase() || '';
                const worker = tx.responsibleEmployeeName?.toLowerCase() || '';
                if (!itemName.includes(q) && !itemSku.includes(q) && !reason.includes(q) && !note.includes(q) && !user.includes(q) && !worker.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [directCharges, selectedCategoryFilter, searchQuery, inventoryMap]);

    const stats = useMemo(() => {
        const totalCount = directCharges.length;
        const totalCost = directCharges.reduce((sum, tx) => {
            if (tx.totalCostCharged) return sum + tx.totalCostCharged;
            const item = inventoryMap.get(tx.itemId);
            return sum + (tx.quantity * (item?.unitCost || 0));
        }, 0);
        const damagedCount = directCharges.filter(tx => tx.chargeCategory === 'DAMAGED_OR_SPILLED').length;
        const unloggedCount = directCharges.filter(tx => tx.chargeCategory === 'UNLOGGED_TREATMENT_OR_FEEDING').length;
        const soldCount = directCharges.filter(tx => tx.chargeCategory === 'SOLD_DIRECTLY').length;
        return { totalCount, totalCost, damagedCount, unloggedCount, soldCount };
    }, [directCharges, inventoryMap]);

    const handleExportCharges = () => {
        const headers = ["Timestamp", "Item Name", "SKU", "Category", "Charge Reason / Type", "Quantity Deducted", "UOM", "Unit Price", "Total Cost", "Logged By", "Responsible Worker", "Audit Note", "Stock Before", "Stock After"];
        const rows = filteredCharges.map(tx => {
            const item = inventoryMap.get(tx.itemId);
            return [
                `"${new Date(tx.date).toLocaleString()}"`,
                `"${item?.name || 'Unknown'}"`,
                `"${item?.sku || 'N/A'}"`,
                `"${item?.category || 'N/A'}"`,
                `"${tx.chargeCategory || 'DIRECT_CHARGE'}"`,
                tx.quantity,
                `"${item?.unitOfMeasure || tx.unitOfMeasure || 'pcs'}"`,
                tx.unitPriceAtCharge || item?.unitCost || 0,
                tx.totalCostCharged || ((tx.quantity) * (item?.unitCost || 0)),
                `"${tx.chargedByUserName || 'System'}"`,
                `"${tx.responsibleEmployeeName || 'N/A'}"`,
                `"${(tx.note || tx.reason || '').replace(/"/g, '""')}"`,
                tx.stockBeforeCharge ?? 'N/A',
                tx.stockAfterCharge ?? 'N/A'
            ];
        });

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `direct_stock_charges_audit_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getCategoryBadge = (category?: string) => {
        switch (category) {
            case 'DAMAGED_OR_SPILLED':
                return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1">💥 Damaged / Spilled</span>;
            case 'UNLOGGED_TREATMENT_OR_FEEDING':
                return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1">🚜 Unlogged Treatment</span>;
            case 'SOLD_DIRECTLY':
                return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1">💰 Sold Directly</span>;
            case 'EXPIRED_OR_DEGRADED':
                return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1">⏳ Expired / Degraded</span>;
            case 'INVENTORY_AUDIT_ADJUSTMENT':
                return <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1">📋 Count Discrepancy</span>;
            case 'DONATION_OR_TRANSFER':
                return <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1">🤝 Donation/Transfer</span>;
            default:
                return <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1">⚡ Direct Charge</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Stat Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Direct Charges</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalCount} Ops</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">Direct stock write-offs</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Loss / Value</p>
                    <p className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(stats.totalCost)}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">Cumulative written-off value</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Damaged / Spilled</p>
                    <p className="text-2xl font-black text-red-600 mt-1">{stats.damagedCount} Events</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">Worker transit / spillages</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Late Field Entries</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">{stats.unloggedCount} Events</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">Unlogged feedings/treatments</p>
                </div>
            </div>

            {/* Table & Filter Card */}
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">Direct Stock Charges Audit Trail</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Full traceability for manual stock deductions: Who, When, Why, Quantity, and Financial Value.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleExportCharges}
                            className="px-4 py-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <DocumentTextIcon className="w-4 h-4" />
                            Export Audit CSV
                        </button>

                        <button
                            onClick={() => onOpenChargeModal?.(null)}
                            className="px-6 py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-100 transition-all flex items-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            + New Direct Charge
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 relative">
                        <SearchIcon className="h-5 w-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by item, author, worker, reason, or notes..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl font-bold text-xs outline-none focus:bg-slate-100"
                        />
                    </div>
                    <div>
                        <select
                            value={selectedCategoryFilter}
                            onChange={e => setSelectedCategoryFilter(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 font-bold text-xs text-slate-700 outline-none focus:bg-slate-100 cursor-pointer"
                        >
                            <option value="all">All Charge Categories (ყველა)</option>
                            <option value="DAMAGED_OR_SPILLED">💥 Damaged / Spilled by Worker</option>
                            <option value="UNLOGGED_TREATMENT_OR_FEEDING">🚜 Unlogged Treatment/Feeding</option>
                            <option value="SOLD_DIRECTLY">💰 Sold Directly</option>
                            <option value="EXPIRED_OR_DEGRADED">⏳ Expired / Degraded</option>
                            <option value="INVENTORY_AUDIT_ADJUSTMENT">📋 Count Discrepancy</option>
                            <option value="DONATION_OR_TRANSFER">🤝 Donation / Transfer</option>
                            <option value="OTHER">📝 Other Direct Charges</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto -mx-6 md:-mx-8">
                    <table className="min-w-full divide-y divide-slate-100 text-left">
                        <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Date & Time</th>
                                <th className="px-6 py-4">Item Details</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4 text-right">Deducted Qty</th>
                                <th className="px-6 py-4 text-right">Total Cost</th>
                                <th className="px-6 py-4">Who & Worker</th>
                                <th className="px-6 py-4">Reason & Audit Note</th>
                                <th className="px-6 py-4 text-center">Stock Flow</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium">
                            {filteredCharges.map(tx => {
                                const item = inventoryMap.get(tx.itemId);
                                return (
                                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-bold">
                                            {new Date(tx.date).toLocaleDateString()}
                                            <span className="text-[10px] text-slate-400 block">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-black text-slate-900">{item?.name || 'Item ID: ' + tx.itemId}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{item?.sku || 'No SKU'} • {item?.category}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getCategoryBadge(tx.chargeCategory)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-black text-rose-600">
                                            -{tx.quantity.toLocaleString()} {item?.unitOfMeasure || tx.unitOfMeasure || 'units'}
                                            {tx.massVolumeCharged && tx.massVolumeCharged !== tx.quantity && (
                                                <span className="text-[10px] text-slate-400 font-bold block">
                                                    ({tx.massVolumeCharged.toLocaleString()} {item?.packageContentUnit || 'kg/L'})
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-black text-slate-800">
                                            {formatCurrency(tx.totalCostCharged || (tx.quantity * (item?.unitCost || 0)))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-bold text-slate-800 flex items-center gap-1">
                                                <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-500 inline" />
                                                {tx.chargedByUserName || 'Admin'}
                                            </div>
                                            {tx.responsibleEmployeeName && (
                                                <div className="text-[10px] text-slate-500 font-bold">
                                                    Worker: <strong className="text-slate-700">{tx.responsibleEmployeeName}</strong>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="font-bold text-slate-800 text-xs truncate">
                                                {tx.reason || 'Manual charge from stock'}
                                            </div>
                                            {tx.note && tx.note !== tx.reason && (
                                                <p className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                                    "{tx.note}"
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            {tx.stockBeforeCharge !== undefined && tx.stockAfterCharge !== undefined ? (
                                                <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                                                    {tx.stockBeforeCharge} ➔ <strong className="text-rose-600">{tx.stockAfterCharge}</strong>
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-bold">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredCharges.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                                        No direct charges recorded yet. Click "+ New Direct Charge" to write off items.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const LiveStockLedger: React.FC<StockViewProps> = ({ stockTransactions = [], inventoryItems = [] }) => {
    const [page, setPage] = useState(1);
    const pageSize = 50;

    const inventoryMap = useMemo(() => {
        return new Map((inventoryItems || []).map(i => [i.id, i]));
    }, [inventoryItems]);

    const sortedTransactions = useMemo(() => {
        return [...stockTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [stockTransactions]);

    const displayedTransactions = useMemo(() => {
        return sortedTransactions.slice(0, page * pageSize);
    }, [sortedTransactions, page]);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase">Live Stock Balance Ledger</h3>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                    <thead>
                        <tr className="border-b-2 border-slate-900 text-xs font-black uppercase text-slate-400">
                            <th className="py-4">Timestamp</th>
                            <th className="py-4">Item</th>
                            <th className="py-4">Tx Type</th>
                            <th className="py-4">Amount</th>
                            <th className="py-4">Source</th>
                            <th className="py-4">Reason & Audit Context</th>
                            <th className="py-4">User</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-bold divide-y divide-slate-100">
                        {displayedTransactions.map(tx => {
                            const item = inventoryMap.get(tx.itemId);
                            return (
                                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                                    <td className="py-4 text-slate-900">{item?.name || 'Unknown Item'} <span className="text-[10px] text-slate-400 block">{item?.category}</span></td>
                                    <td className="py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                            tx.type === 'ADDITION' ? 'bg-emerald-100 text-emerald-700' :
                                            tx.type === 'DEDUCTION' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>{tx.type}</span>
                                    </td>
                                    <td className={`py-4 font-black ${tx.type === 'DEDUCTION' ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {tx.type === 'DEDUCTION' ? '-' : '+'}{tx.quantity.toLocaleString()} {item?.unitOfMeasure || tx.unitOfMeasure}
                                    </td>
                                    <td className="py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                            tx.sourceModule === 'DIRECT_CHARGE' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {tx.sourceModule === 'DIRECT_CHARGE' ? '⚡ DIRECT CHARGE' : tx.sourceModule}
                                        </span>
                                    </td>
                                    <td className="py-4 text-slate-600 text-xs max-w-xs">
                                        <div>{tx.reason}</div>
                                        {tx.note && tx.note !== tx.reason && (
                                            <span className="text-[11px] text-slate-400 italic block mt-0.5">"{tx.note}"</span>
                                        )}
                                    </td>
                                    <td className="py-4 text-slate-500 text-xs font-bold whitespace-nowrap">
                                        {tx.chargedByUserName || 'System'}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {stockTransactions.length === 0 && <div className="py-12 text-center text-slate-400 font-bold uppercase text-xs">No active ledger movements</div>}
                {displayedTransactions.length < stockTransactions.length && (
                    <div className="text-center pt-4">
                        <button onClick={() => setPage(p => p + 1)} className="px-6 py-2 bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">
                            Load More Movements ({stockTransactions.length - displayedTransactions.length} remaining)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const HarvestArchiveList: React.FC<StockViewProps> = (props) => {
    const { formatCurrency } = useLanguage();
    const { harvestEvents = [], onSetHarvestEvents, plantationFeatures = [], employees = [], onSetEmployees, roles = [], inventoryItems = [], employeeGroups = [] } = props;
    const historicalEvents = useMemo(() => harvestEvents.filter(e => e.status === 'completed'), [harvestEvents]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<HarvestEvent | null>(null);
    const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSaveEvent = (eventData: HarvestEvent) => {
        if (onSetHarvestEvents) {
            if (editingEvent) {
                onSetHarvestEvents(harvestEvents.map(e => e.id === eventData.id ? eventData : e));
            } else {
                const newEvent: HarvestEvent = {
                    ...eventData,
                    id: eventData.id || `hev-${Date.now()}`
                };
                onSetHarvestEvents([...harvestEvents, newEvent]);
            }
        }
        setIsEventModalOpen(false);
        setEditingEvent(null);
    };

    const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

    const toggleExpandEvent = (id: string) => {
        setExpandedEventIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleDeleteEvent = (id: string) => {
        setDeletingEventId(id);
    };

    const [aiFilter, setAiFilter] = useState<'all' | 'standard' | 'ai'>('all');

    const filteredHistoricalEvents = useMemo(() => {
        return historicalEvents.filter(e => {
            if (aiFilter === 'standard') return !e.isAiGenerated;
            if (aiFilter === 'ai') return !!e.isAiGenerated;
            return true;
        });
    }, [historicalEvents, aiFilter]);

    const comparisonStats = useMemo(() => {
        const standardEvents = historicalEvents.filter(e => !e.isAiGenerated);
        const aiEvents = historicalEvents.filter(e => !!e.isAiGenerated);

        const standardTotalWeight = standardEvents.reduce((sum, e) => sum + (e.finalNetYieldKg || e.totalNetWeightKg || 0), 0);
        const aiTotalWeight = aiEvents.reduce((sum, e) => sum + (e.finalNetYieldKg || e.totalNetWeightKg || 0), 0);

        const standardCount = standardEvents.length;
        const aiCount = aiEvents.length;

        const standardAvgWeight = standardCount > 0 ? standardTotalWeight / standardCount : 0;
        const aiAvgWeight = aiCount > 0 ? aiTotalWeight / aiCount : 0;

        return {
            standardTotalWeight,
            aiTotalWeight,
            standardCount,
            aiCount,
            standardAvgWeight,
            aiAvgWeight
        };
    }, [historicalEvents]);

    const archivePickerWeightMap = useMemo(() => {
        const map = new Map<string, number>();
        (props.harvestEntries || []).forEach(e => {
            if (e && e.harvestEventId && e.employeeId) {
                const key = `${e.harvestEventId}_${e.employeeId}`;
                map.set(key, (map.get(key) || 0) + (e.netWeightKg || 0));
            }
        });
        return map;
    }, [props.harvestEntries]);

    const selectedEvents = useMemo(() => filteredHistoricalEvents.filter(h => selectedIds.has(h.id)), [filteredHistoricalEvents, selectedIds]);
    const totalKg = useMemo(() => selectedEvents.reduce((sum, e) => sum + (e.finalNetYieldKg || e.totalNetWeightKg || 0), 0), [selectedEvents]);
    
    const totalExpenses = useMemo(() => {
        const machMap = new Map((props.machinery || []).map(m => [m.id, m]));
        const invMap = new Map((inventoryItems || []).map(i => [i.id, i]));

        return selectedEvents.reduce((sum, ev) => {
            let pickerCost = ev.totalPickerCost || 0;
            if (!pickerCost && ev.assignedPickers && ev.assignedPickers.length > 0) {
                const startStr = ev.actualStartDate || ev.plannedStartDate;
                const endStr = ev.actualEndDate || new Date().toISOString();
                const eventDurationMs = new Date(endStr).getTime() - new Date(startStr).getTime();
                const durationHours = Math.max(0, eventDurationMs / (1000 * 60 * 60));
                ev.assignedPickers.forEach(picker => {
                    const scannedWeight = archivePickerWeightMap.get(`${ev.id}_${picker.employeeId}`) || 0;
                    const finalWeight = picker.manualNetWeight ?? scannedWeight;
                    const finalHours = picker.manualHours ?? durationHours;
                    pickerCost += calculatePickerEarnings(picker, finalWeight, finalHours);
                });
            }

            let vehicleCost = ev.totalVehicleCost || 0;
            if (!vehicleCost && ev.assignedVehicles && ev.assignedVehicles.length > 0) {
                ev.assignedVehicles.forEach(v => {
                    if (v.isOwned) {
                        const mach = machMap.get(v.machineryId);
                        const hourly = mach?.hourlyRate || 0;
                        const fuel = mach?.fuelConsumption || 0;
                        let fuelUnitCost = 0;
                        if (mach?.fuelItemId) {
                            const fuelItem = invMap.get(mach.fuelItemId);
                            fuelUnitCost = fuelItem?.unitCost || 0;
                        }
                        vehicleCost += v.usageHours * (hourly + fuel * fuelUnitCost);
                    } else {
                        vehicleCost += v.hiredCost || 0;
                    }
                });
            }

            let packagingCost = ev.totalPackagingCost || 0;
            if (!packagingCost && ev.materialsUsed && ev.materialsUsed.length > 0) {
                packagingCost = ev.materialsUsed.reduce((sumMat, mu) => {
                    const invItem = invMap.get(mu.inventoryItemId);
                    return sumMat + (mu.quantity * (invItem?.unitCost || 0));
                }, 0);
            }

            return sum + pickerCost + vehicleCost + packagingCost;
        }, 0);
    }, [selectedEvents, archivePickerWeightMap, props.machinery, inventoryItems]);
    const totalRevenue = selectedEvents.reduce((sum, e) => sum + (e.saleDetails?.totalValue || 0), 0);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 space-y-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-black text-slate-900 uppercase">Post-Harvest Analytical Archive</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => setIsAiAnalysisOpen(true)} 
                        className="flex-1 sm:flex-none px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                    >
                        <Brain size={14}/> AI Analysis
                    </button>
                    <button 
                        onClick={() => { setEditingEvent(null); setIsEventModalOpen(true); }}
                        className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                        + Add Record
                    </button>
                </div>
            </div>

            {/* AI vs Standard Comparison Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-extrabold uppercase text-[10px] tracking-widest">
                        <span className="w-2.5 h-2.5 bg-slate-400 rounded-full"></span>
                        Standard Events
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-3 rounded-xl border border-slate-100">
                            <span className="block text-[8px] font-black text-slate-400 uppercase">Total Sessions</span>
                            <span className="text-sm font-black text-slate-800">{comparisonStats.standardCount}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-100 col-span-2">
                            <span className="block text-[8px] font-black text-slate-400 uppercase">Total Yield / Average</span>
                            <span className="text-sm font-black text-slate-800">
                                {comparisonStats.standardTotalWeight.toLocaleString()} kg <span className="text-[10px] text-slate-400 font-bold">({Math.round(comparisonStats.standardAvgWeight).toLocaleString()} kg/avg)</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-purple-600 font-extrabold uppercase text-[10px] tracking-widest">
                        <span className="w-2.5 h-2.5 bg-purple-500 rounded-full"></span>
                        AI-Generated Events
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-3 rounded-xl border border-slate-100">
                            <span className="block text-[8px] font-black text-slate-400 uppercase">Total Sessions</span>
                            <span className="text-sm font-black text-slate-800">{comparisonStats.aiCount}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-100 col-span-2">
                            <span className="block text-[8px] font-black text-slate-400 uppercase">Total Yield / Average</span>
                            <span className="text-sm font-black text-purple-700">
                                {comparisonStats.aiTotalWeight.toLocaleString()} kg <span className="text-[10px] text-purple-400 font-bold">({Math.round(comparisonStats.aiAvgWeight).toLocaleString()} kg/avg)</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter controls */}
            <div className="flex border-b border-slate-100 pb-1 gap-2">
                <button 
                    onClick={() => setAiFilter('all')} 
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${aiFilter === 'all' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    All Records ({historicalEvents.length})
                </button>
                <button 
                    onClick={() => setAiFilter('standard')} 
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${aiFilter === 'standard' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Standard Only ({comparisonStats.standardCount})
                </button>
                <button 
                    onClick={() => setAiFilter('ai')} 
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${aiFilter === 'ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    AI-Generated ({comparisonStats.aiCount})
                </button>
            </div>
            
            {/* Multi-Select Summary Aggregator */}
            {selectedIds.size > 0 && (
                <div className="bg-slate-900 p-6 rounded-[2rem] text-white flex flex-wrap gap-8 items-center justify-between sticky top-4 z-10 shadow-2xl">
                    <div className="flex flex-wrap gap-8">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Combined Volume</p>
                            <p className="text-2xl font-black text-emerald-400">{totalKg.toLocaleString()} KG</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Opex</p>
                            <p className="text-2xl font-black text-red-400">{formatCurrency(totalExpenses)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gross Revenue</p>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-black text-blue-400">{formatCurrency(totalRevenue)}</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-black uppercase px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">Clear Selection</button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left">
                    <thead>
                        <tr className="border-b-2 border-slate-900 text-xs font-black uppercase text-slate-400">
                            <th className="py-4 px-2 w-10"></th>
                            <th className="py-4">Record ID</th>
                            <th className="py-4">Session Details</th>
                            <th className="py-4">Session Date</th>
                            <th className="py-4">Total Yield (KG)</th>
                            <th className="py-4">Gross Revenue</th>
                            <th className="py-4">Status</th>
                            <th className="py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-bold divide-y divide-slate-100">
                        {filteredHistoricalEvents.map(h => {
                            const isExpanded = expandedEventIds.has(h.id);
                            
                            const earlyBoxes = h.totalBoxes || 0;
                            const earlyNetWeight = h.totalNetWeightKg || h.finalNetYieldKg || 0;
                            const earlyGrossWeight = h.totalGrossWeightKg || (earlyNetWeight + (earlyBoxes * 1.5));
                            const earlyCost = h.totalPickerCost || 0;

                            const reweighedBoxes = h.reweighTotalBoxes ?? (h.reweighRecords || []).reduce((s, r) => s + r.boxes, 0);
                            const reweighedNetWeight = h.reweighTotalWeight ?? (h.reweighRecords || []).reduce((s, r) => s + r.weight, 0);
                            const reweighedGrossWeight = h.reweighTotalGrossWeight ?? (h.reweighRecords || []).reduce((s, r) => s + (r.brutto || r.weight), 0);
                            const reweighedCost = h.reweighTotalSalary ?? (h.reweighRecords || []).reduce((s, r) => s + (r.salary || 0), 0);

                            const boxDiff = earlyBoxes - reweighedBoxes;
                            const netDiff = earlyNetWeight - reweighedNetWeight;
                            const grossDiff = earlyGrossWeight - reweighedGrossWeight;
                            const costDiff = earlyCost - reweighedCost;

                            const hVarieties = Array.from(new Set([
                                ...(h.yieldByVariety || []).map(y => y.variety),
                                ...(h.reweighRecords || []).map(r => r.variety || "Unspecified"),
                                ...(h.varieties || [])
                            ].filter(Boolean) as string[]));

                            if (hVarieties.length === 0) {
                                hVarieties.push("Chandler");
                            }

                            const hVarietyStats = hVarieties.map(v => {
                                const earlyY = (h.yieldByVariety || []).find(y => y.variety === v || y.variety?.toLowerCase() === v.toLowerCase());
                                const earlyNet = earlyY ? (earlyY.netWeightKg ?? earlyY.weightKg ?? 0) : 0;
                                const earlyBoxes = earlyY ? (earlyY.boxCount ?? 0) : 0;

                                const reweighedRecs = (h.reweighRecords || []).filter(r => r.variety === v || r.variety?.toLowerCase() === v.toLowerCase() || (!r.variety && v === "Unspecified"));
                                const reweighedNet = reweighedRecs.reduce((sum, r) => sum + r.weight, 0);
                                const reweighedBoxes = reweighedRecs.reduce((sum, r) => sum + r.boxes, 0);

                                return {
                                    variety: v,
                                    earlyNet,
                                    earlyBoxes,
                                    reweighedNet,
                                    reweighedBoxes,
                                    netDiff: earlyNet - reweighedNet,
                                    boxDiff: earlyBoxes - reweighedBoxes
                                };
                            });

                            return (
                                <React.Fragment key={h.id}>
                                    <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-indigo-50/20 border-l-4 border-l-indigo-600' : ''}`}>
                                        <td className="py-4 px-2">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.has(h.id)}
                                                onChange={() => toggleSelect(h.id)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="py-4 font-mono text-slate-400 text-xs">
                                            <button 
                                                type="button"
                                                onClick={() => toggleExpandEvent(h.id)}
                                                className="inline-flex items-center gap-1.5 hover:text-indigo-600 text-slate-700 font-bold tracking-tight transition-colors cursor-pointer"
                                                title="Expand detailed yield control comparison"
                                            >
                                                <span className="text-[10px] transition-transform duration-200 inline-block animate-fadeIn" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                                <span>{h.id.toUpperCase().substring(0, 8)}</span>
                                            </button>
                                        </td>
                                        <td className="py-4 text-slate-900">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{typeof h.name === 'object' && h.name ? ((h.name as any).name || (h.name as any).id || '[Object]') : String(h.name || '')}</span>
                                                <button
                                                    onClick={() => toggleExpandEvent(h.id)}
                                                    className="text-[9px] bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 px-2 py-0.5 rounded-md font-black tracking-wide uppercase transition-colors"
                                                >
                                                    Compare details
                                                </button>
                                            </div>
                                            {h.reweighTotalWeight !== undefined && (
                                                <div className="flex flex-wrap gap-1 mt-1 animate-fadeIn">
                                                    <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded font-black">⚖️ RW: {h.reweighTotalWeight.toFixed(1)} kg ({h.reweighTotalBoxes} Bx)</span>
                                                    {h.sellerReportedWeight !== undefined && (
                                                        <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded font-black">🛒 SL: {h.sellerReportedWeight.toFixed(1)} kg</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 text-slate-900">{new Date(h.actualEndDate || h.plannedStartDate).toLocaleDateString()}</td>
                                        <td className="py-4 font-black">
                                            <div>{(h.finalNetYieldKg || h.totalNetWeightKg || 0).toLocaleString()}</div>
                                            {h.reweighTotalWeight !== undefined && (
                                                <div className="text-[10px] text-indigo-500 font-bold mt-0.5" title="Reweighed Difference">
                                                    Diff: {((h.finalNetYieldKg || h.totalNetWeightKg || 0) - h.reweighTotalWeight).toFixed(1)} kg
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 text-slate-500">
                                            {formatCurrency(h.saleDetails?.totalValue || 0)}
                                        </td>
                                        <td className="py-4">
                                            {h.isAiGenerated ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-700">
                                                    <Sparkles size={10} /> AI Generated
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-500">
                                                    Standard
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 text-right space-x-2">
                                            <button 
                                                onClick={() => { setEditingEvent(h); setIsEventModalOpen(true); }}
                                                className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                                title="Edit Record"
                                            >
                                                <PencilSquareIcon className="h-4 w-4 inline-block" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteEvent(h.id)}
                                                className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                                title="Delete Record"
                                            >
                                                <TrashIcon className="h-4 w-4 inline-block" />
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded Reconciliation & Comparison Details Panel */}
                                    {isExpanded && (
                                        <tr className="bg-slate-50/75 animate-slideDown border-l-4 border-l-indigo-600">
                                            <td colSpan={8} className="px-6 py-6 bg-indigo-50/5">
                                                <div className="space-y-6 max-w-5xl">
                                                    {/* Panel Header */}
                                                    <div className="flex flex-wrap justify-between items-center gap-4 border-b border-indigo-100/60 pb-3">
                                                        <div>
                                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                                <span>⚖️</span> Yield Control Detailed Reconciliation Panel
                                                            </h4>
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                                                                Comparing Weight Station Early Entries vs. Reweighed & Corrected Physical Data
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2.5 py-1 uppercase">
                                                                Status: {h.reweighTotalWeight !== undefined ? 'Reconciled' : 'Pending Reweigh'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Bento Comparison Cards */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {/* Early Entries Card */}
                                                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Early Weight Station</span>
                                                                <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Early Logs</span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-xs font-bold text-slate-500">Net Weight:</span>
                                                                    <span className="text-sm font-black text-slate-800">{earlyNetWeight.toFixed(1)} KG</span>
                                                                </div>
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-xs font-bold text-slate-500">Gross Weight:</span>
                                                                    <span className="text-sm font-extrabold text-slate-700">{earlyGrossWeight.toFixed(1)} KG</span>
                                                                </div>
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-xs font-bold text-slate-500">Boxes Total:</span>
                                                                    <span className="text-sm font-extrabold text-slate-700">{earlyBoxes} Boxes</span>
                                                                </div>
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-xs font-bold text-slate-500">Workers Cost:</span>
                                                                    <span className="text-sm font-extrabold text-slate-700">{formatCurrency(earlyCost)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Reweighed & Deduplicated Card */}
                                                        <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 shadow-sm space-y-3">
                                                            <div className="flex justify-between items-center border-b border-indigo-100/40 pb-2">
                                                                <span className="text-[9px] font-black uppercase text-indigo-700 tracking-wider">Reweighed & Corrected</span>
                                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Deduplicated</span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-xs font-bold text-indigo-600">Net Weight:</span>
                                                                    <span className="text-sm font-black text-indigo-800">{reweighedNetWeight.toFixed(1)} KG</span>
                                                                </div>
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-xs font-bold text-indigo-600">Gross Weight:</span>
                                                                    <span className="text-sm font-extrabold text-indigo-700">{reweighedGrossWeight.toFixed(1)} KG</span>
                                                                </div>
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-xs font-bold text-indigo-600">Boxes Total:</span>
                                                                    <span className="text-sm font-extrabold text-indigo-700">{reweighedBoxes} Boxes</span>
                                                                </div>
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-xs font-bold text-indigo-600">Calculated Payroll:</span>
                                                                    <span className="text-sm font-black text-emerald-600">{formatCurrency(reweighedCost)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Discrepancies and Actions Card */}
                                                        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3">
                                                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Net Discrepancies</span>
                                                                <span className="text-[10px] font-black text-amber-400 bg-white/5 px-1.5 py-0.5 rounded">Variance</span>
                                                            </div>
                                                            <div className="space-y-1.5 text-xs">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">Net Delta:</span>
                                                                    <span className={`font-black ${Math.abs(netDiff) < 0.1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                                        {netDiff > 0 ? `+${netDiff.toFixed(1)}` : netDiff.toFixed(1)} KG
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400">Box Delta:</span>
                                                                    <span className={`font-black ${boxDiff === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                                        {boxDiff > 0 ? `+${boxDiff}` : boxDiff} Box
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-400 font-bold">Payroll Delta:</span>
                                                                    <span className={`font-black ${costDiff === 0 ? 'text-slate-400' : 'text-emerald-400'}`}>
                                                                        {costDiff > 0 ? `+${costDiff.toFixed(2)}` : costDiff.toFixed(2)} GEL
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="pt-2 border-t border-white/5 text-[9px] text-slate-400 font-black flex items-center gap-1.5">
                                                                {Math.abs(netDiff) < 0.1 ? (
                                                                    <span className="text-emerald-400">✓ PERFECT DATA SYNC MATCHED</span>
                                                                ) : (
                                                                    <span className="text-amber-400">⚠️ ACTIVE DATA DESYNC ALERT</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Georgian Editorial Discrepancy Note Block */}
                                                    {h.reweighNotes && (
                                                        <div className="bg-amber-50/50 border-l-4 border-amber-400 p-4 rounded-r-2xl space-y-1">
                                                            <p className="text-[9px] font-black uppercase text-amber-800 tracking-widest">📝 Logged Explanation / ჩაწერილი მიზეზი</p>
                                                            <p className="text-xs text-slate-700 italic font-medium leading-relaxed">
                                                                "{h.reweighNotes}"
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Variety Yields and Discrepancy Statistics Table */}
                                                    <div className="space-y-2">
                                                        <h5 className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">🍇 Variety Yield Comparison & Discrepancies</h5>
                                                        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden overflow-x-auto shadow-sm">
                                                            <table className="w-full text-left text-xs font-bold text-slate-700">
                                                                <thead>
                                                                    <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                                                                        <th className="py-2.5 px-4">Variety</th>
                                                                        <th className="py-2.5 px-4 text-right">Early Net</th>
                                                                        <th className="py-2.5 px-4 text-right">Early Boxes</th>
                                                                        <th className="py-2.5 px-4 text-right">Reweighed Net</th>
                                                                        <th className="py-2.5 px-4 text-right">Reweighed Boxes</th>
                                                                        <th className="py-2.5 px-4 text-right">Delta (KG)</th>
                                                                        <th className="py-2.5 px-4 text-right">Delta (Boxes)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {hVarietyStats.map((stat) => {
                                                                        const isPerfect = Math.abs(stat.netDiff) < 0.1;
                                                                        return (
                                                                            <tr key={stat.variety} className="hover:bg-slate-50/50">
                                                                                <td className="py-3 px-4 text-indigo-700 font-extrabold">🍇 {stat.variety}</td>
                                                                                <td className="py-3 px-4 text-right text-slate-500">{stat.earlyNet.toFixed(1)} KG</td>
                                                                                <td className="py-3 px-4 text-right text-slate-500">{stat.earlyBoxes} Bx</td>
                                                                                <td className="py-3 px-4 text-right text-slate-900">{stat.reweighedNet.toFixed(1)} KG</td>
                                                                                <td className="py-3 px-4 text-right text-slate-900">{stat.reweighedBoxes} Bx</td>
                                                                                <td className={`py-3 px-4 text-right ${isPerfect ? 'text-emerald-600 font-bold' : 'text-amber-600 font-black'}`}>
                                                                                    {stat.netDiff > 0 ? `+${stat.netDiff.toFixed(1)}` : stat.netDiff.toFixed(1)} KG
                                                                                </td>
                                                                                <td className={`py-3 px-4 text-right ${stat.boxDiff === 0 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-black'}`}>
                                                                                    {stat.boxDiff > 0 ? `+${stat.boxDiff}` : stat.boxDiff} Bx
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Reweighed Records Break-down List */}
                                                    {(h.reweighRecords || []).length > 0 ? (
                                                        <div className="space-y-2">
                                                            <h5 className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">📋 Deduplicated Records Break-down</h5>
                                                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                                                                <table className="w-full text-left text-xs">
                                                                    <thead>
                                                                        <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                                                                            <th className="py-2.5 px-4">#</th>
                                                                            <th className="py-2.5 px-4">Variety</th>
                                                                            <th className="py-2.5 px-4">Boxes</th>
                                                                            <th className="py-2.5 px-4">Net Weight</th>
                                                                            <th className="py-2.5 px-4">Gross (Brutto)</th>
                                                                            <th className="py-2.5 px-4">Worker / Picker</th>
                                                                            <th className="py-2.5 px-4 text-right">Calculated Salary</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                                                                        {(h.reweighRecords || []).map((r, rIdx) => {
                                                                            const workerObj = employees.find(e => e.id === r.workerId);
                                                                            return (
                                                                                <tr key={r.id || rIdx} className="hover:bg-slate-50/40 transition-colors">
                                                                                    <td className="py-3 px-4 font-mono text-slate-400">#{rIdx + 1}</td>
                                                                                    <td className="py-3 px-4">
                                                                                        {r.variety ? (
                                                                                            <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">🍇 {r.variety}</span>
                                                                                        ) : (
                                                                                            <span className="text-slate-400 italic">Unspecified</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-3 px-4 text-slate-800">{r.boxes} Box</td>
                                                                                    <td className="py-3 px-4 text-slate-900 font-extrabold">{r.weight.toFixed(1)} KG</td>
                                                                                    <td className="py-3 px-4 text-slate-600">{(r.brutto || (r.weight + r.boxes * 1.5)).toFixed(1)} KG</td>
                                                                                    <td className="py-3 px-4">
                                                                                        {workerObj ? (
                                                                                            <div className="flex flex-col">
                                                                                                <span className="text-slate-800 font-bold">{workerObj.name}</span>
                                                                                                <span className="text-[9px] text-slate-400 font-medium">Emp ID: {workerObj.id}</span>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="text-slate-400 font-bold italic">No picker</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-3 px-4 text-right text-emerald-600 font-black">
                                                                                        {r.salary !== undefined ? `${r.salary.toFixed(2)} GEL` : '-'}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-slate-100/50 p-4 rounded-2xl text-center text-xs font-bold text-slate-400 italic uppercase">
                                                            No detailed reweighing breakdown logs logged for this event.
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
                {filteredHistoricalEvents.length === 0 && <div className="py-12 text-center text-slate-400 font-bold uppercase text-xs">No historical harvest records</div>}
            </div>

            {isEventModalOpen && (
                <HarvestEventModal
                    event={editingEvent}
                    onSave={handleSaveEvent}
                    onClose={() => setIsEventModalOpen(false)}
                    sectors={(plantationFeatures || []).filter(f => f.type === 'area') as AreaPlantationFeature[]}
                    plantationFeatures={plantationFeatures}
                    employees={employees}
                    onSetEmployees={onSetEmployees || (() => {})}
                    roles={roles}
                    inventoryItems={inventoryItems}
                    employeeGroups={employeeGroups}
                    defaultStatus="completed"
                />
            )}

            {isAiAnalysisOpen && (
                <HarvestAiAnalysisModal
                    isOpen={isAiAnalysisOpen}
                    onClose={() => setIsAiAnalysisOpen(false)}
                    harvestEvents={props.harvestEvents || []}
                />
            )}

            {/* Custom Modal for deleting single event in Post-Harvest Archive to ensure iframe compatibility */}
            {deletingEventId && (
                <div className="fixed inset-0 bg-black/50 z-[2001] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl border border-slate-100 transform scale-100 transition-all text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600">
                            <TrashIcon className="h-6 w-6" />
                        </div>
                        <h3 className="font-extrabold text-lg text-slate-900">Delete Harvest Record?</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Are you sure you want to delete this completed harvest record? This action will permanently remove this item. This cannot be undone.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setDeletingEventId(null)} 
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    if (onSetHarvestEvents) {
                                        onSetHarvestEvents(harvestEvents.filter(e => e.id !== deletingEventId));
                                    }
                                    setDeletingEventId(null);
                                }} 
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors shadow-lg shadow-red-100"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockView;
