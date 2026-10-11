import React, { useState, useEffect, useMemo } from 'react';
import { 
    FileSpreadsheet, 
    Download, 
    Upload, 
    ExternalLink, 
    RefreshCw, 
    Check, 
    AlertTriangle, 
    Plus, 
    Layers, 
    X, 
    Table, 
    PieChart, 
    Sparkles, 
    Calendar,
    Users,
    TrendingUp,
    ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { 
    listUserSpreadsheets, 
    getSpreadsheetDetails, 
    readSheetValues, 
    createSpreadsheet, 
    writeSheetData,
    ensureGoogleToken,
    prepareWorkersSheetData,
    preparePayrollSheetData,
    prepareHarvestSheetData,
    prepareStockSheetData,
    prepareTasksAndWorksSheetData,
    prepareAgronomySheetData,
    prepareMapPlantStatsSheetData,
    prepareAccountsSheetData,
    prepareHarvestProduceDetailedSheetData,
    prepareHarvestSalesDetailedSheetData,
    prepareColdStorageDetailedSheetData,
    preparePostHarvestArchiveDetailedSheetData,
    prepareLiveStockLedgerDetailedSheetData,
    prepareAgroInputsDetailedSheetData,
    prepareAssetsMachineryDetailedSheetData,
    prepareSuppliesDetailedSheetData,
    preparePurchaseOrdersDetailedSheetData,
    prepareSupplierDirectoryDetailedSheetData,
    prepareDirectChargesDetailedSheetData,
    GoogleSpreadsheetItem,
    GoogleSheetTabInfo
} from '../services/googleSheetsService';
import { getAccessToken, googleSignIn } from '../firebase';
import type { 
    Employee, 
    HarvestEvent, 
    InventoryItem, 
    Transaction, 
    Account, 
    WorkAssignment, 
    PlantationFeature, 
    NutritionPlan, 
    PlanExecution,
    DailyLogEntry,
    User,
    StockTransaction,
    Supplier,
    PurchaseOrder,
    Machinery
} from '../types';

export type GoogleSheetsModuleType = 
    | 'all'
    | 'workers'
    | 'payroll'
    | 'harvest'
    | 'stock'
    | 'tasks'
    | 'agronomy'
    | 'map'
    | 'accounts'
    | 'harvest_produce'
    | 'sales'
    | 'cold_storage'
    | 'post_harvest_archive'
    | 'live_ledger'
    | 'agro_inputs'
    | 'assets'
    | 'supplies'
    | 'purchase_orders'
    | 'supplier_directory'
    | 'direct_charges';

interface GoogleSheetsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialModule?: GoogleSheetsModuleType;
    initialMode?: 'export' | 'import';
    employees: Employee[];
    onSetEmployees?: (employees: Employee[]) => void;
    harvestEvents?: HarvestEvent[];
    inventoryItems?: InventoryItem[];
    onSetInventoryItems?: (items: InventoryItem[]) => void;
    workAssignments?: WorkAssignment[];
    nutritionPlans?: NutritionPlan[];
    planExecutions?: PlanExecution[];
    plantationFeatures?: PlantationFeature[];
    transactions?: Transaction[];
    onSetTransactions?: (txns: Transaction[]) => void;
    accounts?: Account[];
    dailyLogs?: DailyLogEntry[];
    currentUser?: User | null;
    activeOrgId?: string | null;
    onImportHarvestData?: (data: any[]) => void;
    stockTransactions?: StockTransaction[];
    onSetStockTransactions?: (txns: StockTransaction[]) => void;
    suppliers?: Supplier[];
    onSetSuppliers?: (suppliers: Supplier[]) => void;
    purchaseOrders?: PurchaseOrder[];
    onSetPurchaseOrders?: (orders: PurchaseOrder[]) => void;
    machinery?: Machinery[];
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
    isOpen,
    onClose,
    initialModule = 'all',
    initialMode = 'export',
    employees = [],
    onSetEmployees,
    harvestEvents = [],
    inventoryItems = [],
    onSetInventoryItems,
    workAssignments = [],
    nutritionPlans = [],
    planExecutions = [],
    plantationFeatures = [],
    transactions = [],
    onSetTransactions,
    accounts = [],
    dailyLogs = [],
    currentUser,
    activeOrgId,
    onImportHarvestData,
    stockTransactions = [],
    onSetStockTransactions,
    suppliers = [],
    onSetSuppliers,
    purchaseOrders = [],
    onSetPurchaseOrders,
    machinery = []
}) => {
    const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialMode);
    const [selectedModule, setSelectedModule] = useState<GoogleSheetsModuleType>(initialModule);
    
    // Auth State
    const [token, setToken] = useState<string | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(false);

    // Export Options
    const [exportTarget, setExportTarget] = useState<'new' | 'existing'>('new');
    const [newSheetTitle, setNewSheetTitle] = useState<string>(() => `AgriMap_Master_Report_${new Date().toISOString().split('T')[0]}`);
    const [existingSpreadsheets, setExistingSpreadsheets] = useState<GoogleSpreadsheetItem[]>([]);
    const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
    const [existingTabs, setExistingTabs] = useState<GoogleSheetTabInfo[]>([]);
    const [selectedTabName, setSelectedTabName] = useState<string>('');
    const [writeMode, setWriteMode] = useState<'overwrite' | 'append'>('overwrite');

    // Execution States
    const [isLoadingDrive, setIsLoadingDrive] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);

    // Confirmation Modal for mutating user data (MANDATORY per workspace-integration rules)
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmActionDetails, setConfirmActionDetails] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);

    // Import State
    const [importSpreadsheetId, setImportSpreadsheetId] = useState<string>('');
    const [importTabName, setImportTabName] = useState<string>('');
    const [importPreviewData, setImportPreviewData] = useState<any[][]>([]);
    const [isLoadingImportPreview, setIsLoadingImportPreview] = useState(false);

    // Update state when initialModule changes
    useEffect(() => {
        if (initialModule) setSelectedModule(initialModule);
        if (initialMode) setActiveTab(initialMode);
    }, [initialModule, initialMode, isOpen]);

    // Check token on mount/open
    useEffect(() => {
        if (isOpen) {
            checkAuth();
        }
    }, [isOpen]);

    const checkAuth = async () => {
        try {
            const tok = await getAccessToken();
            setToken(tok);
            if (tok) {
                fetchRecentSpreadsheets(tok);
            }
        } catch (e) {
            console.warn("Could not retrieve token:", e);
        }
    };

    const handleLogin = async () => {
        setIsLoadingAuth(true);
        try {
            const userRes = await googleSignIn();
            if (!userRes) {
                // User cancelled or closed the popup
                return;
            }
            const tok = userRes.accessToken || (await getAccessToken());
            setToken(tok);
            if (tok) {
                toast.success("Google Account connected successfully!");
                fetchRecentSpreadsheets(tok);
            }
        } catch (err: any) {
            const code = err?.code || '';
            const msg = err?.message || '';
            if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
                console.info("Google Sign-In closed by user.");
            } else {
                console.error("Sign-in error:", err);
                toast.error("Google Authorization cancelled or failed.");
            }
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const fetchRecentSpreadsheets = async (authToken?: string) => {
        setIsLoadingDrive(true);
        try {
            const list = await listUserSpreadsheets(authToken || token || undefined);
            setExistingSpreadsheets(list);
            if (list.length > 0 && !selectedSpreadsheetId) {
                setSelectedSpreadsheetId(list[0].id);
                setImportSpreadsheetId(list[0].id);
                fetchTabsForSpreadsheet(list[0].id, authToken);
            }
        } catch (err: any) {
            console.warn("Failed to fetch spreadsheets list:", err);
        } finally {
            setIsLoadingDrive(false);
        }
    };

    const fetchTabsForSpreadsheet = async (sheetId: string, authToken?: string) => {
        if (!sheetId) return;
        try {
            const details = await getSpreadsheetDetails(sheetId, authToken || token || undefined);
            setExistingTabs(details.sheets);
            if (details.sheets.length > 0) {
                setSelectedTabName(details.sheets[0].title);
                setImportTabName(details.sheets[0].title);
            }
        } catch (err) {
            console.warn("Could not load tabs:", err);
        }
    };

    // Calculate current dataset to export based on selectedModule
    const currentDataset = useMemo(() => {
        if (selectedModule === 'workers') {
            return [prepareWorkersSheetData(employees, activeOrgId)];
        } else if (selectedModule === 'payroll') {
            return [preparePayrollSheetData(employees, dailyLogs, harvestEvents)];
        } else if (selectedModule === 'harvest') {
            return [prepareHarvestSheetData(harvestEvents)];
        } else if (selectedModule === 'harvest_produce') {
            return [prepareHarvestProduceDetailedSheetData(inventoryItems, harvestEvents)];
        } else if (selectedModule === 'sales') {
            return [prepareHarvestSalesDetailedSheetData(inventoryItems)];
        } else if (selectedModule === 'cold_storage') {
            return [prepareColdStorageDetailedSheetData(inventoryItems)];
        } else if (selectedModule === 'post_harvest_archive') {
            return [preparePostHarvestArchiveDetailedSheetData(inventoryItems)];
        } else if (selectedModule === 'live_ledger') {
            return [prepareLiveStockLedgerDetailedSheetData(stockTransactions, inventoryItems)];
        } else if (selectedModule === 'agro_inputs') {
            return [prepareAgroInputsDetailedSheetData(inventoryItems)];
        } else if (selectedModule === 'assets') {
            return [prepareAssetsMachineryDetailedSheetData(machinery, inventoryItems)];
        } else if (selectedModule === 'supplies') {
            return [prepareSuppliesDetailedSheetData(inventoryItems)];
        } else if (selectedModule === 'purchase_orders') {
            return [preparePurchaseOrdersDetailedSheetData(purchaseOrders)];
        } else if (selectedModule === 'supplier_directory') {
            return [prepareSupplierDirectoryDetailedSheetData(suppliers)];
        } else if (selectedModule === 'direct_charges') {
            return [prepareDirectChargesDetailedSheetData(stockTransactions, inventoryItems)];
        } else if (selectedModule === 'stock') {
            return [
                prepareStockSheetData(inventoryItems),
                prepareHarvestProduceDetailedSheetData(inventoryItems, harvestEvents),
                prepareHarvestSalesDetailedSheetData(inventoryItems),
                prepareColdStorageDetailedSheetData(inventoryItems),
                prepareAgroInputsDetailedSheetData(inventoryItems),
                prepareSuppliesDetailedSheetData(inventoryItems),
                prepareLiveStockLedgerDetailedSheetData(stockTransactions, inventoryItems),
                prepareDirectChargesDetailedSheetData(stockTransactions, inventoryItems)
            ];
        } else if (selectedModule === 'tasks') {
            return [prepareTasksAndWorksSheetData(workAssignments, employees)];
        } else if (selectedModule === 'agronomy') {
            return [prepareAgronomySheetData(nutritionPlans, planExecutions, plantationFeatures)];
        } else if (selectedModule === 'map') {
            return [prepareMapPlantStatsSheetData(plantationFeatures)];
        } else if (selectedModule === 'accounts') {
            return [prepareAccountsSheetData(transactions, accounts)];
        } else {
            // ALL MODULES! Complete enterprise multi-tab export
            return [
                prepareWorkersSheetData(employees, activeOrgId),
                preparePayrollSheetData(employees, dailyLogs, harvestEvents),
                prepareHarvestSheetData(harvestEvents),
                prepareHarvestProduceDetailedSheetData(inventoryItems, harvestEvents),
                prepareHarvestSalesDetailedSheetData(inventoryItems),
                prepareColdStorageDetailedSheetData(inventoryItems),
                preparePostHarvestArchiveDetailedSheetData(inventoryItems),
                prepareAgroInputsDetailedSheetData(inventoryItems),
                prepareAssetsMachineryDetailedSheetData(machinery, inventoryItems),
                prepareSuppliesDetailedSheetData(inventoryItems),
                preparePurchaseOrdersDetailedSheetData(purchaseOrders),
                prepareSupplierDirectoryDetailedSheetData(suppliers),
                prepareLiveStockLedgerDetailedSheetData(stockTransactions, inventoryItems),
                prepareDirectChargesDetailedSheetData(stockTransactions, inventoryItems),
                prepareTasksAndWorksSheetData(workAssignments, employees),
                prepareAgronomySheetData(nutritionPlans, planExecutions, plantationFeatures),
                prepareMapPlantStatsSheetData(plantationFeatures),
                prepareAccountsSheetData(transactions, accounts)
            ];
        }
    }, [
        selectedModule, 
        employees, 
        activeOrgId, 
        dailyLogs, 
        harvestEvents, 
        inventoryItems, 
        workAssignments, 
        nutritionPlans, 
        planExecutions, 
        plantationFeatures, 
        transactions, 
        accounts,
        stockTransactions,
        suppliers,
        purchaseOrders,
        machinery
    ]);

    // Handle initiating export (triggers confirmation modal for user safety)
    const handleInitiateExport = () => {
        const targetTitle = exportTarget === 'new' 
            ? newSheetTitle 
            : existingSpreadsheets.find(s => s.id === selectedSpreadsheetId)?.name || 'Existing Spreadsheet';

        const description = exportTarget === 'new'
            ? `Create a brand new Google Spreadsheet named "${targetTitle}" in your Google Drive with ${currentDataset.length} tab(s) and full statistics.`
            : `Write ${currentDataset.length} dataset(s) to "${targetTitle}" (${writeMode === 'overwrite' ? 'Overwriting sheet tab contents' : 'Appending new rows'}).`;

        setConfirmActionDetails({
            title: exportTarget === 'new' ? 'Create New Google Spreadsheet' : 'Sync to Google Spreadsheet',
            description,
            action: executeExport
        });
        setShowConfirmModal(true);
    };

    const executeExport = async () => {
        setIsExecuting(true);
        try {
            const authToken = await ensureGoogleToken();
            setToken(authToken);

            if (exportTarget === 'new') {
                const res = await createSpreadsheet(newSheetTitle.trim() || 'AgriMap Export', currentDataset, authToken);
                setLastCreatedUrl(res.spreadsheetUrl);
                toast.success(`Google Spreadsheet created with ${currentDataset.length} sheet tabs!`);
            } else {
                if (!selectedSpreadsheetId) {
                    throw new Error("Please select a target spreadsheet from your Google Drive.");
                }

                for (const ds of currentDataset) {
                    const tabTitle = currentDataset.length === 1 && selectedTabName ? selectedTabName : ds.title;
                    await writeSheetData(
                        selectedSpreadsheetId,
                        tabTitle,
                        ds.headers,
                        [...ds.rows, ...(ds.summaryRows && ds.summaryRows.length > 0 ? [[], ...ds.summaryRows] : [])],
                        writeMode,
                        authToken
                    );
                }
                const targetSheet = existingSpreadsheets.find(s => s.id === selectedSpreadsheetId);
                const url = targetSheet?.webViewLink || `https://docs.google.com/spreadsheets/d/${selectedSpreadsheetId}`;
                setLastCreatedUrl(url);
                toast.success(`Successfully synchronized data to Google Spreadsheet!`);
            }
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error(err.message || "Failed to export data to Google Sheets.");
        } finally {
            setIsExecuting(false);
            setShowConfirmModal(false);
        }
    };

    // Handle Import Preview
    const handleLoadImportPreview = async () => {
        if (!importSpreadsheetId || !importTabName) {
            toast.error("Please select a spreadsheet and tab to import.");
            return;
        }

        setIsLoadingImportPreview(true);
        try {
            const authToken = await ensureGoogleToken();
            setToken(authToken);
            const values = await readSheetValues(importSpreadsheetId, `'${importTabName}'!A1:Z50`, authToken);
            setImportPreviewData(values);
            if (values.length === 0) {
                toast.info("Selected sheet tab is empty.");
            } else {
                toast.success(`Loaded preview of ${values.length} rows from Google Sheet!`);
            }
        } catch (err: any) {
            console.error("Import preview error:", err);
            toast.error(err.message || "Could not read data from Google Sheet.");
        } finally {
            setIsLoadingImportPreview(false);
        }
    };

    // Execute Import Confirmation
    const handleInitiateImport = () => {
        if (importPreviewData.length < 2) {
            toast.error("Need at least 1 header row and 1 data row to import.");
            return;
        }

        const count = importPreviewData.length - 1;
        let moduleName = 'workers';
        if (selectedModule === 'accounts') moduleName = 'bank transactions';
        else if (selectedModule === 'harvest') moduleName = 'harvest data for AI analysis';

        setConfirmActionDetails({
            title: `Import ${count} Records from Google Sheets`,
            description: `Import ${count} rows from "${importTabName}" into ${moduleName}. This will add new records to your system.`,
            action: executeImport
        });
        setShowConfirmModal(true);
    };

    const executeImport = async () => {
        setIsExecuting(true);
        try {
            const rows = importPreviewData.slice(1);

            if (selectedModule === 'workers' || selectedModule === 'all') {
                if (!onSetEmployees) throw new Error("Employee setter not provided.");
                const importedWorkers: Employee[] = rows.map((r, idx) => ({
                    id: `emp-gsheet-${Date.now()}-${idx}`,
                    idNumber: String(r[2] || r[0] || ''),
                    name: String(r[1] || r[0] || `Worker ${idx + 1}`),
                    phone: String(r[3] || ''),
                    email: String(r[4] || ''),
                    roleId: String(r[5] || 'Worker'),
                    employeeType: (r[6] === 'Temporary' ? 'Temporary' : 'Permanent') as any,
                    paymentType: (r[7] === 'daily' ? 'daily' : 'hourly') as any,
                    paymentRate: Number(r[8]) || 10,
                    accountType: String(r[9] || 'Bank Account') as any,
                    isGeorgianCitizen: String(r[10] || '').toLowerCase().includes('geo'),
                    age: Number(r[11]) || undefined,
                    sex: String(r[12] || ''),
                    status: (r[13] || 'active') as any,
                    joinedAt: new Date().toISOString(),
                    organizationId: activeOrgId || null
                }));

                onSetEmployees([...employees, ...importedWorkers]);
                toast.success(`Successfully imported ${importedWorkers.length} workers from Google Sheet!`);
            } else if (selectedModule === 'accounts') {
                if (!onSetTransactions) throw new Error("Transaction setter not provided.");
                const importedTxns: Transaction[] = rows.map((r, idx) => {
                    const isIncome = String(r[3] || '').toLowerCase().includes('inc');
                    const primaryAcc = accounts[0]?.id || 'acc-primary';
                    return {
                        id: `txn-gsheet-${Date.now()}-${idx}`,
                        date: r[1] ? new Date(r[1]).toISOString() : new Date().toISOString(),
                        debitAccountId: isIncome ? primaryAcc : 'acc-external',
                        creditAccountId: isIncome ? 'acc-external' : primaryAcc,
                        transactionType: (isIncome ? 'INCOME' : 'EXPENSE') as any,
                        category: String(r[4] || 'General'),
                        description: String(r[5] || 'Imported from Google Sheet'),
                        amount: Math.abs(Number(r[6])) || 0,
                        senderName: isIncome ? String(r[7] || '') : '',
                        receiverName: !isIncome ? String(r[7] || '') : '',
                        referenceId: String(r[8] || '')
                    } as any;
                });

                onSetTransactions([...transactions, ...importedTxns]);
                toast.success(`Successfully imported ${importedTxns.length} bank transactions!`);
            } else if (selectedModule === 'harvest' && onImportHarvestData) {
                onImportHarvestData(rows);
                toast.success(`Sent ${rows.length} harvest records to Harvest AI for automated analysis!`);
            } else if (['stock', 'agro_inputs', 'supplies', 'assets', 'harvest_produce'].includes(selectedModule)) {
                if (!onSetInventoryItems) throw new Error("Inventory setter not provided.");
                const importedItems: InventoryItem[] = rows.map((r, idx) => ({
                    id: `inv-gsheet-${Date.now()}-${idx}`,
                    sku: String(r[0] || `SKU-${Date.now()}-${idx}`),
                    name: String(r[1] || `Item ${idx + 1}`),
                    category: (r[2] || (selectedModule === 'agro_inputs' ? 'Fertilizers' : selectedModule === 'supplies' ? 'Packaging' : selectedModule === 'assets' ? 'Machinery' : selectedModule === 'harvest_produce' ? 'Produce' : 'Other')) as any,
                    currentStock: Number(r[3] || r[4]) || 0,
                    unitOfMeasure: String(r[4] || 'Units'),
                    minStockThreshold: Number(r[8] || 0),
                    unitCost: Number(r[5]) || 0,
                    location: String(r[7] || 'Central Warehouse'),
                    supplierId: String(r[10] || r[11] || '')
                } as any));
                onSetInventoryItems([...inventoryItems, ...importedItems]);
                toast.success(`Successfully imported ${importedItems.length} inventory items into ${selectedModule}!`);
            } else if (selectedModule === 'supplier_directory') {
                if (!onSetSuppliers) throw new Error("Supplier setter not provided.");
                const importedSuppliers: Supplier[] = rows.map((r, idx) => ({
                    id: `sup-gsheet-${Date.now()}-${idx}`,
                    name: String(r[1] || r[0] || `Supplier ${idx + 1}`),
                    contactPerson: String(r[2] || ''),
                    phone: String(r[3] || ''),
                    email: String(r[4] || ''),
                    address: String(r[5] || ''),
                    taxId: String(r[6] || ''),
                    category: String(r[7] || 'All')
                } as any));
                onSetSuppliers([...suppliers, ...importedSuppliers]);
                toast.success(`Successfully imported ${importedSuppliers.length} suppliers into Directory!`);
            } else if (selectedModule === 'purchase_orders') {
                if (!onSetPurchaseOrders) throw new Error("Purchase orders setter not provided.");
                const importedPOs: PurchaseOrder[] = rows.map((r, idx) => ({
                    id: `po-gsheet-${Date.now()}-${idx}`,
                    orderNumber: String(r[0] || `PO-${Date.now()}-${idx}`),
                    supplierName: String(r[1] || 'Supplier'),
                    orderDate: r[2] ? new Date(r[2]).toISOString() : new Date().toISOString(),
                    expectedDeliveryDate: r[3] ? new Date(r[3]).toISOString() : undefined,
                    status: (r[4] || 'Pending') as any,
                    totalAmount: Number(r[8] || r[6] || 0),
                    items: []
                } as any));
                onSetPurchaseOrders([...purchaseOrders, ...importedPOs]);
                toast.success(`Successfully imported ${importedPOs.length} Purchase Orders!`);
            } else if (selectedModule === 'direct_charges' || selectedModule === 'live_ledger') {
                if (!onSetStockTransactions) throw new Error("Stock transaction setter not provided.");
                const importedCharges: StockTransaction[] = rows.map((r, idx) => ({
                    id: `stk-gsheet-${Date.now()}-${idx}`,
                    date: r[1] ? new Date(r[1]).toISOString() : new Date().toISOString(),
                    itemId: String(r[2] || ''),
                    type: String(r[3] || 'DEDUCTION') as any,
                    quantity: Number(r[4] || 1),
                    unitOfMeasure: String(r[5] || 'Units'),
                    unitPriceAtCharge: Number(r[6] || 0),
                    totalCostCharged: Number(r[7] || 0),
                    sourceModule: selectedModule === 'direct_charges' ? 'DIRECT_CHARGE' : 'INVENTORY',
                    reason: String(r[8] || 'Google Sheets Sync'),
                    chargeCategory: String(r[8] || 'Operational Charge'),
                    responsibleEmployeeName: String(r[9] || ''),
                    chargedByUserName: String(r[10] || 'Admin')
                } as any));
                onSetStockTransactions([...stockTransactions, ...importedCharges]);
                toast.success(`Successfully imported ${importedCharges.length} ledger movements!`);
            } else {
                toast.info("Import preview completed.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to process imported rows.");
        } finally {
            setIsExecuting(false);
            setShowConfirmModal(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
                
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                            <FileSpreadsheet size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black uppercase tracking-wider">
                                    Google Sheets Workspace Sync
                                </h2>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 text-[10px] font-mono font-bold border border-emerald-300/30">
                                    Live Integration
                                </span>
                            </div>
                            <p className="text-xs text-emerald-100/90 font-medium">
                                Export, import, and build seasonal statistics across all operational farm modules
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {token ? (
                            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-xl text-xs font-bold text-emerald-100 border border-white/10">
                                <ShieldCheck size={14} className="text-emerald-300" /> Connected
                            </span>
                        ) : (
                            <button
                                onClick={handleLogin}
                                disabled={isLoadingAuth}
                                className="px-3 py-1.5 rounded-xl bg-white text-emerald-800 text-xs font-black uppercase tracking-wider hover:bg-emerald-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                                {isLoadingAuth ? <RefreshCw size={14} className="animate-spin" /> : <Users size={14} />}
                                Sign in with Google
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Subnav & Mode Toggles */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-2xl">
                        <button
                            onClick={() => setActiveTab('export')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                                activeTab === 'export'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Download size={14} /> Export to Google Sheets
                        </button>
                        <button
                            onClick={() => setActiveTab('import')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                                activeTab === 'import'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Upload size={14} /> Import from Google Sheets
                        </button>
                    </div>

                    {/* Module Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex-shrink-0">
                            Module:
                        </span>
                        {[
                            { id: 'all', label: 'All Modules' },
                            { id: 'workers', label: 'HR Registry' },
                            { id: 'payroll', label: 'Payroll' },
                            { id: 'harvest', label: 'Harvest AI & Yield' },
                            { id: 'harvest_produce', label: 'Harvest Produce' },
                            { id: 'sales', label: 'Sales' },
                            { id: 'cold_storage', label: 'Cold Storage' },
                            { id: 'post_harvest_archive', label: 'Post Harvest' },
                            { id: 'live_ledger', label: 'Live Ledger' },
                            { id: 'agro_inputs', label: 'Agro Inputs' },
                            { id: 'assets', label: 'Assets' },
                            { id: 'supplies', label: 'Supplies' },
                            { id: 'purchase_orders', label: 'P. Orders' },
                            { id: 'supplier_directory', label: 'Directory' },
                            { id: 'direct_charges', label: 'Direct Charges' },
                            { id: 'stock', label: 'Full Stock' },
                            { id: 'tasks', label: 'Tasks & Works' },
                            { id: 'agronomy', label: 'Agronomy' },
                            { id: 'map', label: 'Map Plants' },
                            { id: 'accounts', label: 'Accounts' }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => setSelectedModule(m.id as GoogleSheetsModuleType)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                    selectedModule === m.id
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* EXPORT VIEW */}
                    {activeTab === 'export' && (
                        <div className="space-y-6">
                            
                            {/* Destination Chooser */}
                            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                    <Layers size={16} className="text-emerald-600" />
                                    1. Choose Destination in Google Drive
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label 
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1.5 ${
                                            exportTarget === 'new' 
                                                ? 'border-emerald-600 bg-emerald-50/50' 
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                <Plus size={16} className="text-emerald-600" />
                                                Create New Google Spreadsheet
                                            </span>
                                            <input 
                                                type="radio" 
                                                name="exportTarget" 
                                                checked={exportTarget === 'new'} 
                                                onChange={() => setExportTarget('new')} 
                                                className="text-emerald-600"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Creates a fresh spreadsheet in your Drive containing configured tabs, frozen headers, and statistical calculation summaries.
                                        </p>
                                    </label>

                                    <label 
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1.5 ${
                                            exportTarget === 'existing' 
                                                ? 'border-emerald-600 bg-emerald-50/50' 
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                <Table size={16} className="text-emerald-600" />
                                                Sync to Existing Spreadsheet
                                            </span>
                                            <input 
                                                type="radio" 
                                                name="exportTarget" 
                                                checked={exportTarget === 'existing'} 
                                                onChange={() => setExportTarget('existing')} 
                                                className="text-emerald-600"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Append or update rows in an existing spreadsheet from your Google Drive.
                                        </p>
                                    </label>
                                </div>

                                {exportTarget === 'new' ? (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700">Spreadsheet File Title</label>
                                        <input
                                            type="text"
                                            value={newSheetTitle}
                                            onChange={(e) => setNewSheetTitle(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="e.g. AgriMap Harvest & Operations 2026"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-700">Select Spreadsheet from Drive</label>
                                            <button 
                                                onClick={() => fetchRecentSpreadsheets()} 
                                                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                                            >
                                                <RefreshCw size={12} className={isLoadingDrive ? "animate-spin" : ""} /> Refresh Drive List
                                            </button>
                                        </div>

                                        {existingSpreadsheets.length === 0 ? (
                                            <div className="p-4 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                                                {isLoadingDrive ? "Scanning Google Drive..." : "No Google Spreadsheets found in your account. You can select 'Create New Google Spreadsheet' above."}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <select
                                                    value={selectedSpreadsheetId}
                                                    onChange={(e) => {
                                                        setSelectedSpreadsheetId(e.target.value);
                                                        fetchTabsForSpreadsheet(e.target.value);
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                                >
                                                    {existingSpreadsheets.map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.name} ({new Date(s.modifiedTime).toLocaleDateString()})
                                                        </option>
                                                    ))}
                                                </select>

                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={writeMode}
                                                        onChange={(e) => setWriteMode(e.target.value as any)}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    >
                                                        <option value="overwrite">Overwrite sheet contents</option>
                                                        <option value="append">Append new rows to bottom</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Live Preview of Data to Export */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-emerald-600" />
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                            2. Preview Datasets to Export ({currentDataset.length} sheet tab{currentDataset.length > 1 ? 's' : ''})
                                        </h4>
                                    </div>
                                    <span className="text-xs font-medium text-slate-500">
                                        Includes summary totals & analytics formulas
                                    </span>
                                </div>

                                <div className="p-4 space-y-4 max-h-[340px] overflow-y-auto">
                                    {currentDataset.map((ds, idx) => (
                                        <div key={idx} className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                                                    Tab: {ds.title}
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    {ds.rows.length} rows • {ds.headers.length} columns
                                                </span>
                                            </div>

                                            {/* Preview Table of First 3 Rows */}
                                            <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                                <table className="w-full text-left text-[11px] text-slate-600">
                                                    <thead className="bg-slate-50 font-bold text-slate-800 border-b border-slate-200">
                                                        <tr>
                                                            {ds.headers.slice(0, 6).map((h, hIdx) => (
                                                                <th key={hIdx} className="px-2.5 py-1.5 whitespace-nowrap">{h}</th>
                                                            ))}
                                                            {ds.headers.length > 6 && <th className="px-2.5 py-1.5 text-slate-400">+{ds.headers.length - 6} more</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                                                        {ds.rows.slice(0, 3).map((row, rIdx) => (
                                                            <tr key={rIdx} className="hover:bg-slate-50">
                                                                {row.slice(0, 6).map((val, cIdx) => (
                                                                    <td key={cIdx} className="px-2.5 py-1.5 whitespace-nowrap">{String(val)}</td>
                                                                ))}
                                                                {row.length > 6 && <td className="px-2.5 py-1.5 text-slate-400">...</td>}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Summary Rows Preview */}
                                            {ds.summaryRows && ds.summaryRows.length > 0 && (
                                                <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-lg p-2 text-[10px] font-bold text-emerald-900 flex flex-wrap gap-x-4 gap-y-1">
                                                    {ds.summaryRows[ds.summaryRows.length - 1].filter(Boolean).map((metric, mIdx) => (
                                                        <span key={mIdx} className="inline-flex items-center gap-1">
                                                            • {String(metric)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Export Actions & Link */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                {lastCreatedUrl ? (
                                    <a
                                        href={lastCreatedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-emerald-200 transition-all border border-emerald-300 shadow-sm"
                                    >
                                        <ExternalLink size={16} /> Open in Google Sheets
                                    </a>
                                ) : (
                                    <div className="text-xs text-slate-400 font-medium hidden sm:block">
                                        Files are created directly in your linked Google Drive
                                    </div>
                                )}

                                <button
                                    onClick={handleInitiateExport}
                                    disabled={isExecuting}
                                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                                >
                                    {isExecuting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                                    {exportTarget === 'new' ? 'Export & Create Spreadsheet' : 'Sync to Spreadsheet'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* IMPORT VIEW */}
                    {activeTab === 'import' && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                    <Upload size={16} className="text-emerald-600" />
                                    1. Select Spreadsheet & Sheet Tab to Import
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700">Select Google Spreadsheet</label>
                                        <select
                                            value={importSpreadsheetId}
                                            onChange={(e) => {
                                                setImportSpreadsheetId(e.target.value);
                                                fetchTabsForSpreadsheet(e.target.value);
                                            }}
                                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                            <option value="">-- Choose from Google Drive --</option>
                                            {existingSpreadsheets.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700">Select Sheet Tab</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={importTabName}
                                                onChange={(e) => setImportTabName(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                            >
                                                {existingTabs.map(t => (
                                                    <option key={t.sheetId} value={t.title}>{t.title}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleLoadImportPreview}
                                                disabled={isLoadingImportPreview || !importSpreadsheetId}
                                                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                                            >
                                                {isLoadingImportPreview ? <RefreshCw size={14} className="animate-spin" /> : <Table size={14} />}
                                                Load Data
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Import Preview Table */}
                            {importPreviewData.length > 0 ? (
                                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-2">
                                    <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                            Loaded {importPreviewData.length} Rows (Header + Records)
                                        </h4>
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            Target: {selectedModule.toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="max-h-[300px] overflow-auto">
                                        <table className="w-full text-left text-xs text-slate-700">
                                            <thead className="bg-slate-50 font-bold border-b border-slate-200 sticky top-0">
                                                <tr>
                                                    {importPreviewData[0]?.map((cell: any, cIdx: number) => (
                                                        <th key={cIdx} className="px-3 py-2 whitespace-nowrap">{String(cell)}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                                {importPreviewData.slice(1, 15).map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-slate-50">
                                                        {row.map((cell: any, cIdx: number) => (
                                                            <td key={cIdx} className="px-3 py-2 whitespace-nowrap">{String(cell)}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                        <p className="text-xs text-slate-500">
                                            Ready to import into {selectedModule === 'accounts' ? 'Bank Accounts' : selectedModule === 'harvest' ? 'Harvest AI Analyzer' : 'HR Employee Registry'}.
                                        </p>
                                        <button
                                            onClick={handleInitiateImport}
                                            disabled={isExecuting}
                                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95"
                                        >
                                            {isExecuting ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                                            Confirm & Register {importPreviewData.length - 1} Records
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2 bg-slate-50/50">
                                    <FileSpreadsheet className="mx-auto text-slate-400" size={36} />
                                    <p className="text-sm font-bold text-slate-700">No Sheet Loaded Yet</p>
                                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                        Select a spreadsheet and tab above, then click "Load Data" to preview and map the rows to your system.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>Protected by Google Workspace OAuth 2.0 with User Confirmation Safeguards</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* MANDATORY USER CONFIRMATION MODAL (per workspace-integration guidelines) */}
            {showConfirmModal && confirmActionDetails && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">{confirmActionDetails.title}</h3>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{confirmActionDetails.description}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 font-medium">
                            ⚠️ This action connects with your Google Workspace Account and updates files in your Google Drive.
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isExecuting}
                                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => confirmActionDetails.action()}
                                disabled={isExecuting}
                                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                            >
                                {isExecuting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                Confirm & Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
