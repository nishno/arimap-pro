import { toast } from 'sonner';
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
    StockTransaction,
    Supplier,
    PurchaseOrder,
    Machinery
} from '../types';

export interface GoogleSpreadsheetItem {
    id: string;
    name: string;
    modifiedTime: string;
    webViewLink?: string;
}

export interface GoogleSheetTabInfo {
    sheetId: number;
    title: string;
    rowCount?: number;
    columnCount?: number;
}

export interface GoogleSpreadsheetDetails {
    spreadsheetId: string;
    title: string;
    spreadsheetUrl: string;
    sheets: GoogleSheetTabInfo[];
}

/**
 * Ensure an active Google OAuth token is available.
 * If not present, prompts user to sign in via Google popup.
 */
export async function ensureGoogleToken(): Promise<string> {
    let token = await getAccessToken();
    if (!token) {
        toast.info("Connecting to Google Account...");
        const res = await googleSignIn();
        token = res?.accessToken || (await getAccessToken());
    }
    if (!token) {
        throw new Error("Google authorization is required to access Google Sheets.");
    }
    return token;
}

/**
 * Extract a spreadsheet ID from a full Google Sheets URL or raw ID string.
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
    if (!urlOrId) return null;
    const trimmed = urlOrId.trim();
    // Matches /spreadsheets/d/([a-zA-Z0-9-_]+)
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return match[1];
    }
    // If it's already an ID (alphanumeric, dashes, underscores, length >= 20)
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
        return trimmed;
    }
    return null;
}

/**
 * Fetch list of spreadsheets from the user's Google Drive.
 */
export async function listUserSpreadsheets(token?: string): Promise<GoogleSpreadsheetItem[]> {
    const accessToken = token || (await ensureGoogleToken());
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const fields = encodeURIComponent("files(id, name, modifiedTime, webViewLink)");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&pageSize=30&fields=${fields}`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Failed to fetch spreadsheets (${res.status})`);
    }

    const data = await res.json();
    return (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}`
    }));
}

/**
 * Get spreadsheet details including all tabs.
 * Avoids assuming the tab is named "Sheet1".
 */
export async function getSpreadsheetDetails(
    spreadsheetId: string, 
    token?: string
): Promise<GoogleSpreadsheetDetails> {
    const accessToken = token || (await ensureGoogleToken());
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets(properties(sheetId,title,gridProperties))`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Failed to retrieve spreadsheet metadata (${res.status})`);
    }

    const data = await res.json();
    const sheets: GoogleSheetTabInfo[] = (data.sheets || []).map((s: any) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title || 'Sheet1',
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount
    }));

    return {
        spreadsheetId: data.spreadsheetId,
        title: data.properties?.title || 'Untitled Spreadsheet',
        spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        sheets
    };
}

/**
 * Read 2D values matrix from a specific sheet range.
 */
export async function readSheetValues(
    spreadsheetId: string,
    range: string,
    token?: string
): Promise<any[][]> {
    const accessToken = token || (await ensureGoogleToken());
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Failed to read values from sheet range ${range} (${res.status})`);
    }

    const data = await res.json();
    return data.values || [];
}

/**
 * Read spreadsheet values wrapped in an object { values: any[][] }
 */
export async function readSpreadsheet(
    spreadsheetId: string,
    range: string = 'A1:Z500',
    token?: string
): Promise<{ values: any[][] }> {
    const values = await readSheetValues(spreadsheetId, range, token);
    return { values };
}

/**
 * Create a new spreadsheet in the user's Google Drive with initial tabs and styled data.
 */
export async function createSpreadsheet(
    title: string,
    sheetsData: { title: string; headers: string[]; rows: any[][]; summaryRows?: any[][] }[],
    token?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const accessToken = token || (await ensureGoogleToken());

    const sheetsPayload = sheetsData.map((s, idx) => ({
        properties: {
            sheetId: idx === 0 ? 0 : 1000 + idx,
            title: s.title,
            gridProperties: {
                rowCount: Math.max(100, s.rows.length + (s.summaryRows?.length || 0) + 15),
                columnCount: Math.max(10, s.headers.length + 2),
                frozenRowCount: 1
            }
        }
    }));

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            properties: {
                title
            },
            sheets: sheetsPayload
        })
    });

    if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Failed to create Google Spreadsheet (${createRes.status})`);
    }

    const created = await createRes.json();
    const spreadsheetId = created.spreadsheetId;
    const spreadsheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Populate data for each tab
    const valueData: any[] = [];
    sheetsData.forEach((s) => {
        const allRows = [
            s.headers,
            ...s.rows,
            ...(s.summaryRows && s.summaryRows.length > 0 ? [[], ...s.summaryRows] : [])
        ];
        valueData.push({
            range: `'${s.title}'!A1`,
            majorDimension: 'ROWS',
            values: allRows
        });
    });

    if (valueData.length > 0) {
        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                valueInputOption: 'USER_ENTERED',
                data: valueData
            })
        });

        if (!updateRes.ok) {
            console.warn("Failed to populate initial sheet values, but sheet container was created:", await updateRes.text());
        }
    }

    return { spreadsheetId, spreadsheetUrl };
}

/**
 * Append or overwrite data into an existing spreadsheet.
 */
export async function writeSheetData(
    spreadsheetId: string,
    sheetTitle: string,
    headers: string[],
    rows: any[][],
    mode: 'overwrite' | 'append' = 'overwrite',
    token?: string
): Promise<{ updatedRows: number }> {
    const accessToken = token || (await ensureGoogleToken());

    // First check if sheet tab exists; if not, add it
    const details = await getSpreadsheetDetails(spreadsheetId, accessToken);
    const existingTab = details.sheets.find(s => s.title.toLowerCase() === sheetTitle.toLowerCase());
    const targetTitle = existingTab ? existingTab.title : sheetTitle;

    if (!existingTab) {
        // Add tab
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [{
                    addSheet: {
                        properties: {
                            title: sheetTitle,
                            gridProperties: {
                                frozenRowCount: 1
                            }
                        }
                    }
                }]
            })
        });
    }

    if (mode === 'overwrite') {
        const values = [headers, ...rows];
        const range = `'${targetTitle}'!A1`;
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Failed to update sheet (${res.status})`);
        }
        return { updatedRows: values.length };
    } else {
        // Append mode
        const range = `'${targetTitle}'!A1`;
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: rows
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Failed to append rows to sheet (${res.status})`);
        }
        return { updatedRows: rows.length };
    }
}

/* =======================================================================
 * MODULE-SPECIFIC EXPORT & STATISTICAL AGGREGATION HELPERS
 * ======================================================================= */

/**
 * 1. HR: Export Workers
 */
export function prepareWorkersSheetData(employees: Employee[], filterOrgId?: string | null) {
    const list = filterOrgId && filterOrgId !== 'ALL'
        ? employees.filter(e => e.organizationId === filterOrgId)
        : employees;

    const headers = [
        'ID / უნიკალური ნომერი',
        'Full Name / სახელი, გვარი',
        'Personal ID / პირადი ნომერი',
        'Phone / ტელეფონი',
        'Email / ელ-ფოსტა',
        'Role / პოზიცია',
        'Employee Type / ტიპი',
        'Payment Model / ანაზღაურება',
        'Hourly/Daily Rate (GEL)',
        'Account Type / ანგარიში',
        'Citizen / მოქალაქეობა',
        'Age / ასაკი',
        'Sex / სქესი',
        'Status / სტატუსი',
        'Joined Date / მიღების თარიღი'
    ];

    const rows = list.map(e => [
        e.idNumber || e.barcode || e.id,
        e.name || '',
        e.idNumber || '',
        e.phone || '',
        e.email || '',
        e.roleId || 'Worker',
        e.employeeType || 'Permanent',
        e.paymentType || 'hourly',
        Number(e.paymentRate || 0),
        e.accountType || 'Bank Account',
        e.isGeorgianCitizen ? 'Georgian' : 'Foreigner',
        e.age || '',
        e.sex || '',
        e.status || 'active',
        e.joinedAt ? new Date(e.joinedAt).toLocaleDateString() : ''
    ]);

    const activeCount = list.filter(e => e.status === 'active').length;
    const avgRate = list.length > 0 ? (list.reduce((acc, e) => acc + (e.paymentRate || 0), 0) / list.length).toFixed(2) : '0';

    const summaryRows = [
        ['--- SUMMARY STATISTICS ---', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['Total Workers Listed:', list.length, '', 'Active Workers:', activeCount, '', 'Average Rate (GEL):', Number(avgRate)]
    ];

    return { title: 'Workers_Registry', headers, rows, summaryRows };
}

/**
 * 2. HR: Export Payroll (by chosen workers, teams & units)
 */
export function preparePayrollSheetData(
    employees: Employee[],
    dailyLogs: DailyLogEntry[] = [],
    harvestEvents: HarvestEvent[] = [],
    selectedWorkerIds?: string[]
) {
    const targetWorkers = selectedWorkerIds && selectedWorkerIds.length > 0
        ? employees.filter(e => selectedWorkerIds.includes(e.id))
        : employees;

    const headers = [
        'Worker ID',
        'Worker Name / თანამშრომელი',
        'Payment Model',
        'Rate (GEL)',
        'Work Hours',
        'Base Wages (GEL)',
        'Harvest Yield Picked (KG)',
        'Harvest Piece Wages (GEL)',
        'Bonus (GEL)',
        'Total Gross Payroll (GEL)',
        'Payment Status',
        'Bank / Wallet Account'
    ];

    let grandHours = 0;
    let grandBaseWages = 0;
    let grandWeightKg = 0;
    let grandHarvestWages = 0;
    let grandBonus = 0;
    let grandTotalPayroll = 0;

    const rows = targetWorkers.map(w => {
        // Calculate work hours from daily logs
        const workerLogs = dailyLogs.filter(d => d.employeeId === w.id);
        const hours = workerLogs.reduce((acc, l: any) => acc + (l.hoursWorked || (l.logType === 'Present' ? 8 : (l.logType === 'Late' ? 6 : 0))), 0);
        const rate = w.paymentRate || 0;
        const baseWages = w.paymentType === 'daily' ? (hours / 8) * rate : hours * rate;

        // Calculate harvest contributions
        let harvestKg = 0;
        let harvestPay = 0;
        let bonus = 0;

        harvestEvents.forEach(ev => {
            const pickers: any[] = ev.assignedPickers || (ev as any).pickers || [];
            const picker = pickers.find((p: any) => p.id === w.id || p.employeeId === w.id);
            if (picker) {
                harvestKg += (picker.totalKg || picker.netWeight || picker.manualNetWeight || picker.payableNetWeight || 0);
                harvestPay += (picker.earnings || (picker.payableNetWeight ? picker.payableNetWeight * (picker.rate || 0) : 0));
                bonus += (picker.bonus || 0);
            }
        });

        const totalPay = baseWages + harvestPay + bonus;

        grandHours += hours;
        grandBaseWages += baseWages;
        grandWeightKg += harvestKg;
        grandHarvestWages += harvestPay;
        grandBonus += bonus;
        grandTotalPayroll += totalPay;

        return [
            w.idNumber || w.id,
            w.name,
            w.paymentType || 'hourly',
            rate,
            hours,
            Number(baseWages.toFixed(2)),
            Number(harvestKg.toFixed(2)),
            Number(harvestPay.toFixed(2)),
            Number(bonus.toFixed(2)),
            Number(totalPay.toFixed(2)),
            'Pending Settlement',
            w.accountType || 'Bank Account'
        ];
    });

    const summaryRows = [
        ['--- PAYROLL TOTALS ---', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTALS:',
            `${targetWorkers.length} Workers`,
            '',
            '',
            Number(grandHours.toFixed(1)),
            Number(grandBaseWages.toFixed(2)),
            Number(grandWeightKg.toFixed(2)),
            Number(grandHarvestWages.toFixed(2)),
            Number(grandBonus.toFixed(2)),
            Number(grandTotalPayroll.toFixed(2)),
            '',
            ''
        ]
    ];

    return { title: 'Payroll_Settlement', headers, rows, summaryRows };
}

/**
 * 3. Harvest Events & Seasonal Statistics
 */
export function prepareHarvestSheetData(harvestEvents: HarvestEvent[], yearOrSeason?: string) {
    const headers = [
        'Event ID',
        'Date / თარიღი',
        'Title / ღონისძიება',
        'Field / Sector',
        'Status',
        'Total Gross (KG)',
        'Total Net (KG)',
        'Boxes / ტარა (Qty)',
        'Pickers Quantity',
        'Picker Payroll (GEL)',
        'Logistics & Opex (GEL)',
        'Estimated Revenue (GEL)',
        'Net Operating Margin (GEL)',
        'Cultivars / ჯიშები'
    ];

    let sumGross = 0;
    let sumNet = 0;
    let sumBoxes = 0;
    let sumPickers = 0;
    let sumPayroll = 0;
    let sumOpex = 0;
    let sumRevenue = 0;

    const rows = harvestEvents.map(ev => {
        const netKg = ev.totalNetWeightKg || (ev as any).totalNetWeight || (ev as any).totalWeight || 0;
        const grossKg = ev.totalGrossWeightKg || (ev as any).totalGrossWeight || netKg;
        const boxes = ev.totalBoxes || 0;
        const pickers: any[] = ev.assignedPickers || (ev as any).pickers || [];
        const pickersCount = pickers.length;
        const payroll = ev.totalPickerCost || (ev as any).totalLaborCost || pickers.reduce((acc: number, p: any) => acc + (p.earnings || 0), 0) || 0;
        const opex = (ev as any).logisticsCost || 0;
        const estRevenue = netKg * 12.5; // Benchmark 12.5 GEL/kg
        const margin = estRevenue - (payroll + opex);

        sumGross += grossKg;
        sumNet += netKg;
        sumBoxes += boxes;
        sumPickers += pickersCount;
        sumPayroll += payroll;
        sumOpex += opex;
        sumRevenue += estRevenue;

        const varietiesStr = ((ev as any).yieldByVariety || []).map((v: any) => `${v.variety}: ${v.weightKg}kg`).join(', ') || 'Mixed';

        return [
            ev.id,
            ev.plannedStartDate ? new Date(ev.plannedStartDate).toLocaleDateString() : ((ev as any).date ? new Date((ev as any).date).toLocaleDateString() : ''),
            ev.name || (ev as any).title || 'Harvest Event',
            ev.sectorId || (ev as any).fieldId || 'Main Parcel',
            ev.status || 'Completed',
            Number(grossKg.toFixed(2)),
            Number(netKg.toFixed(2)),
            boxes,
            pickersCount,
            Number(payroll.toFixed(2)),
            Number(opex.toFixed(2)),
            Number(estRevenue.toFixed(2)),
            Number(margin.toFixed(2)),
            varietiesStr
        ];
    });

    const summaryRows = [
        ['--- SEASONAL HARVEST STATISTICS ---', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTALS:',
            `${harvestEvents.length} Events`,
            '',
            '',
            '',
            Number(sumGross.toFixed(2)),
            Number(sumNet.toFixed(2)),
            sumBoxes,
            sumPickers,
            Number(sumPayroll.toFixed(2)),
            Number(sumOpex.toFixed(2)),
            Number(sumRevenue.toFixed(2)),
            Number((sumRevenue - (sumPayroll + sumOpex)).toFixed(2)),
            ''
        ],
        [
            'AVERAGES / KEY METRICS:',
            `Avg Yield per Event: ${(sumNet / (harvestEvents.length || 1)).toFixed(1)} KG`,
            `Avg Opex per KG: ${sumNet > 0 ? ((sumPayroll + sumOpex) / sumNet).toFixed(2) : 0} GEL/KG`,
            `Net Profit Margin: ${sumRevenue > 0 ? (((sumRevenue - (sumPayroll + sumOpex)) / sumRevenue) * 100).toFixed(1) : 0}%`
        ]
    ];

    return { title: 'Harvest_Analytics', headers, rows, summaryRows };
}

/**
 * 4. Stock & Inventory: Produce, Sales, Inputs, Assets, Purchase Orders
 */
export function prepareStockSheetData(items: InventoryItem[]) {
    const headers = [
        'Item Code / SKU',
        'Name / დასახელება',
        'Category / კატეგორია',
        'Current Stock / ნაშთი',
        'Unit / ერთეული',
        'Unit Cost / თვითღირებულება (GEL)',
        'Total Valuation / ღირებულება (GEL)',
        'Storage Location / საწყობი',
        'Min Threshold / მინიმუმი',
        'Status / სტატუსი',
        'Supplier / მომწოდებელი',
        'Last Restocked Date'
    ];

    let totalValuation = 0;
    let totalStockUnits = 0;

    const rows = items.map(item => {
        const stock = Number(item.currentStock || (item as any).quantity || 0);
        const unitCost = Number(item.unitCost || (item as any).costPerUnit || (item as any).price || 0);
        const valuation = stock * unitCost;

        totalStockUnits += stock;
        totalValuation += valuation;

        const minStock = item.minStockThreshold || (item as any).minStock || 0;

        return [
            item.sku || item.id,
            item.name,
            item.category || 'General',
            stock,
            item.unitOfMeasure || (item as any).unit || 'KG',
            Number(unitCost.toFixed(2)),
            Number(valuation.toFixed(2)),
            (item as any).warehouse || item.location || 'Central Warehouse',
            minStock,
            stock <= minStock ? 'LOW STOCK' : 'OPTIMAL',
            (item as any).supplier || item.supplierId || '',
            (item as any).lastRestocked ? new Date((item as any).lastRestocked).toLocaleDateString() : ''
        ];
    });

    const summaryRows = [
        ['--- INVENTORY & VALUATION AUDIT ---', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL ASSETS:',
            `${items.length} SKUs`,
            '',
            Number(totalStockUnits.toFixed(1)),
            '',
            '',
            Number(totalValuation.toFixed(2)),
            '',
            '',
            '',
            '',
            ''
        ]
    ];

    return { title: 'Stock_Live_Ledger', headers, rows, summaryRows };
}

/**
 * 5. Tasks & Works: Events by Name & Category, Worker Data, Payroll & Costs
 */
export function prepareTasksAndWorksSheetData(
    assignments: WorkAssignment[],
    employees: Employee[] = []
) {
    const headers = [
        'Task ID',
        'Task Name / სამუშაო',
        'Category / კატეგორია',
        'Status / სტატუსი',
        'Priority / პრიორიტეტი',
        'Field / Sector',
        'Assigned Workers Qty',
        'Worker Names / ბრიგადა',
        'Estimated Hours',
        'Actual Hours',
        'Labor Cost (GEL)',
        'Machinery Cost (GEL)',
        'Material Inputs Cost (GEL)',
        'Total Task Cost (GEL)',
        'Start Date',
        'Due Date'
    ];

    let totalLaborCost = 0;
    let totalMachineryCost = 0;
    let totalMaterialCost = 0;
    let totalOverallCost = 0;

    const rows = assignments.map(task => {
        const workerIds = task.assignedEmployeeIds || [];
        const workerNames = workerIds
            .map(id => employees.find(e => e.id === id)?.name || id)
            .join(', ');

        const labor = Number((task as any).laborCost || 0);
        const mach = Number((task as any).machineryCost || 0);
        const mat = Number((task as any).materialCost || 0);
        const total = labor + mach + mat;

        totalLaborCost += labor;
        totalMachineryCost += mach;
        totalMaterialCost += mat;
        totalOverallCost += total;

        return [
            task.id,
            (task as any).workName || (task as any).title || 'Agronomic Task',
            (task as any).category || 'Maintenance',
            task.status || 'Pending',
            (task as any).priority || 'Medium',
            (task as any).sectorId || (task.sectorIds && task.sectorIds[0]) || (task as any).targetLocation || 'All Parcels',
            workerIds.length,
            workerNames || 'Unassigned',
            (task as any).estimatedHours || 0,
            (task as any).actualHours || 0,
            Number(labor.toFixed(2)),
            Number(mach.toFixed(2)),
            Number(mat.toFixed(2)),
            Number(total.toFixed(2)),
            (task as any).startDate ? new Date((task as any).startDate).toLocaleDateString() : '',
            (task as any).dueDate ? new Date((task as any).dueDate).toLocaleDateString() : ''
        ];
    });

    const summaryRows = [
        ['--- OPERATIONAL COST & TASK SUMMARY ---', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTALS:',
            `${assignments.length} Tasks`,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            Number(totalLaborCost.toFixed(2)),
            Number(totalMachineryCost.toFixed(2)),
            Number(totalMaterialCost.toFixed(2)),
            Number(totalOverallCost.toFixed(2)),
            '',
            ''
        ]
    ];

    return { title: 'Tasks_And_Works', headers, rows, summaryRows };
}

/**
 * 6. Agronomy: Statistics for Treatments & Feeding
 */
export function prepareAgronomySheetData(
    nutritionPlans: NutritionPlan[] = [],
    planExecutions: PlanExecution[] = [],
    features: PlantationFeature[] = []
) {
    const headers = [
        'Plan / Execution ID',
        'Type (Nutrition / Protection)',
        'Formula / Product Name',
        'Target Sector / Trench',
        'Application Method',
        'Dosage (Per Ha or Liter)',
        'Total Applied Qty',
        'Total Cost (GEL)',
        'Execution Date',
        'Status',
        'Technician / Agronomist Notes'
    ];

    let totalAgronomyCost = 0;
    let totalQty = 0;

    const rows: any[][] = [];

    // Nutrition plans
    nutritionPlans.forEach(plan => {
        ((plan as any).applications || []).forEach((app: any, idx: number) => {
            const cost = Number(app.estimatedCost || (app.dosage * 15) || 0);
            totalAgronomyCost += cost;
            totalQty += Number(app.dosage || 0);

            rows.push([
                `${plan.id}-step${idx + 1}`,
                (plan as any).type || 'Fertilization',
                app.fertilizerName || app.productName || plan.name,
                app.targetSector || 'Field-wide',
                app.method || 'Fertigation Drip',
                `${app.dosage || 0} ${app.unit || 'KG/ha'}`,
                app.totalQuantity || app.dosage || 0,
                Number(cost.toFixed(2)),
                app.date || new Date().toLocaleDateString(),
                app.completed ? 'Executed' : 'Scheduled',
                app.notes || (plan as any).description || ''
            ]);
        });
    });

    // Plan executions
    planExecutions.forEach(exec => {
        const cost = Number((exec as any).cost || 0);
        totalAgronomyCost += cost;
        rows.push([
            exec.id,
            (exec as any).type || 'Treatment',
            (exec as any).productName || 'Compound Mix',
            (exec as any).sectorId || (exec.sectorIds && exec.sectorIds[0]) || 'Field-wide',
            (exec as any).method || 'Foliar Spray',
            `${(exec as any).dosage || 0}`,
            (exec as any).quantityApplied || 0,
            Number(cost.toFixed(2)),
            (exec as any).executionDate ? new Date((exec as any).executionDate).toLocaleDateString() : '',
            (exec as any).status || 'Applied',
            exec.notes || ''
        ]);
    });

    const summaryRows = [
        ['--- AGRONOMY CHEMICAL & FEEDING SUMMARY ---', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTALS:',
            `${rows.length} Interventions`,
            '',
            '',
            '',
            '',
            Number(totalQty.toFixed(1)),
            Number(totalAgronomyCost.toFixed(2)),
            '',
            '',
            ''
        ]
    ];

    return { title: 'Agronomy_Treatments', headers, rows, summaryRows };
}

/**
 * 7. Map Planner: Statistics for Trenches, Seeds & Plant Health
 */
export function prepareMapPlantStatsSheetData(features: PlantationFeature[]) {
    const headers = [
        'Feature ID',
        'Sector / Field Name',
        'Feature Type (Sector / Trench / Seed)',
        'Cultivar / Variety',
        'Plants Count / რაოდენობა',
        'Health Status (Good / Suspicious / Dried)',
        'Row Length (m)',
        'Area (Ha)',
        'Planting Date',
        'GPS Center Coordinates'
    ];

    let totalPlants = 0;
    let healthyCount = 0;
    let suspiciousCount = 0;
    let driedCount = 0;
    let totalAreaHa = 0;
    let totalLengthM = 0;

    const rows = features.map(f => {
        const props = (f as any).properties || {};
        const count = Number(props.plantCount || props.treeCount || 1);
        const health = props.healthStatus || (props.status === 'dried' ? 'Dried' : props.status === 'suspicious' ? 'Suspicious' : 'Good');
        const area = Number(props.areaHa || 0);
        const length = Number(props.lengthMeters || 0);

        totalPlants += count;
        totalAreaHa += area;
        totalLengthM += length;

        if (health.toLowerCase() === 'dried') driedCount += count;
        else if (health.toLowerCase() === 'suspicious') suspiciousCount += count;
        else healthyCount += count;

        let center = '';
        if (f.geometry) {
            const coords = Array.isArray(f.geometry) ? f.geometry : (f.geometry as any).coordinates;
            if (Array.isArray(coords) && coords.length > 0) {
                const first = Array.isArray(coords[0]) ? coords[0] : coords;
                center = `${first[0]}, ${first[1]}`;
            }
        }

        return [
            f.id,
            (f as any).properties?.name || (f as any).properties?.sectorName || 'Parcel',
            f.type,
            (f as any).properties?.variety || (f as any).properties?.crop || 'Blueberry',
            count,
            health,
            Number(length.toFixed(1)),
            Number(area.toFixed(3)),
            (f as any).properties?.plantedAt ? new Date((f as any).properties.plantedAt).toLocaleDateString() : '',
            center
        ];
    });

    const summaryRows = [
        ['--- PLANT POPULATION & HEALTH AUDIT ---', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL PLANTS:',
            totalPlants,
            '',
            'Healthy:',
            healthyCount,
            `Suspicious: ${suspiciousCount} | Dried: ${driedCount}`,
            Number(totalLengthM.toFixed(1)),
            Number(totalAreaHa.toFixed(3)),
            '',
            ''
        ],
        [
            'MORTALITY RATE:',
            totalPlants > 0 ? `${((driedCount / totalPlants) * 100).toFixed(2)}%` : '0%',
            '',
            'SURVIVAL RATE:',
            totalPlants > 0 ? `${((healthyCount / totalPlants) * 100).toFixed(2)}%` : '100%'
        ]
    ];

    return { title: 'Map_Plants_And_Trenches', headers, rows, summaryRows };
}

/**
 * 8. Accounts: Bank Transactions & Salary Settlement Desk
 */
export function prepareAccountsSheetData(
    transactions: Transaction[],
    accounts: Account[] = []
) {
    const headers = [
        'Transaction ID',
        'Date / თარიღი',
        'Wallet / Bank Account',
        'Type (Income / Expense / Transfer)',
        'Category / დანიშნულება',
        'Description / აღწერა',
        'Amount (GEL)',
        'Counterparty / კონტრაგენტი',
        'Tax Invoice / დოკუმენტი',
        'Settlement Status'
    ];

    let totalIncome = 0;
    let totalExpense = 0;

    const rows = transactions.map(t => {
        const accId = (t as any).accountId || t.debitAccountId || t.creditAccountId;
        const acc = accounts.find(a => a.id === accId);
        const amount = Number(t.amount || 0);
        const txType = (t as any).type || (t as any).transactionType || '';
        if (txType === 'income' || txType === 'INCOME') totalIncome += amount;
        else if (txType === 'expense' || txType === 'EXPENSE') totalExpense += amount;

        return [
            t.id,
            t.date ? new Date(t.date).toLocaleDateString() : '',
            acc ? `${acc.name} (${acc.type})` : (accId || 'Primary LLC Account'),
            String(txType).toUpperCase() || 'TRANSACTION',
            t.category || 'General',
            t.description || '',
            Number(amount.toFixed(2)),
            (t as any).counterparty || (t as any).senderName || (t as any).receiverName || '',
            (t as any).invoiceNumber || t.referenceId || (t as any).documentNumber || '',
            (t as any).status || 'Settled'
        ];
    });

    const summaryRows = [
        ['--- FINANCIAL STATEMENT & LEDGER SUMMARY ---', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL INCOME:',
            Number(totalIncome.toFixed(2)),
            '',
            'TOTAL EXPENSE:',
            Number(totalExpense.toFixed(2)),
            '',
            'NET CASH FLOW:',
            Number((totalIncome - totalExpense).toFixed(2)),
            '',
            ''
        ]
    ];

    return { title: 'Bank_And_Ledger', headers, rows, summaryRows };
}

/**
 * 9. Stock: Harvest Produce (Fresh Yield & In-Bin Batches)
 */
export function prepareHarvestProduceDetailedSheetData(items: InventoryItem[], events: HarvestEvent[] = []) {
    const produceItems = items.filter(i => i.category === 'Produce' && !i.isPrivate && i.status !== 'COLD_STORAGE_RETURNED');
    const headers = [
        'Batch / SKU',
        'Produce Name / მოსავალი',
        'Crop / Variety',
        'Status',
        'Current Stock (KG)',
        'Boxes / ტარა (Qty)',
        'Storage Location',
        'Unit Cost (GEL/KG)',
        'Estimated Value (GEL)',
        'Related Harvest Event',
        'Date Received',
        'Target Sector'
    ];

    let totalKg = 0;
    let totalBoxes = 0;
    let totalValuation = 0;

    const rows = produceItems.map(item => {
        const kg = Number(item.currentStock || (item as any).quantity || 0);
        const boxes = Number((item as any).boxes || 0);
        const unitCost = Number(item.unitCost || (item as any).costPerUnit || (item as any).price || 0);
        const val = kg * unitCost;

        totalKg += kg;
        totalBoxes += boxes;
        totalValuation += val;

        const relEvent = events.find(e => e.id === item.relatedHarvestId);

        return [
            item.sku || item.id,
            item.name,
            (item as any).variety || (item as any).crop || 'Blueberry',
            item.status || 'AVAILABLE',
            Number(kg.toFixed(2)),
            boxes,
            (item as any).warehouse || item.location || 'Fresh Storage',
            Number(unitCost.toFixed(2)),
            Number(val.toFixed(2)),
            relEvent?.name || (relEvent as any)?.title || item.relatedHarvestId || 'Direct Batch',
            (item as any).lastRestocked ? new Date((item as any).lastRestocked).toLocaleDateString() : '',
            relEvent?.sectorId || 'Main Parcel'
        ];
    });

    const summaryRows = [
        ['--- HARVEST PRODUCE INVENTORY SUMMARY ---', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL HARVEST PRODUCE:',
            `${produceItems.length} Batches`,
            '',
            '',
            Number(totalKg.toFixed(2)),
            totalBoxes,
            '',
            '',
            Number(totalValuation.toFixed(2)),
            '',
            '',
            ''
        ]
    ];

    return { title: 'Stock_Harvest_Produce', headers, rows, summaryRows };
}

/**
 * 10. Stock: Harvest Sales & Realization
 */
export function prepareHarvestSalesDetailedSheetData(items: InventoryItem[]) {
    const produceItems = items.filter(i => i.category === 'Produce');
    const headers = [
        'SKU / Batch ID',
        'Product / დასახელება',
        'Variety',
        'Quantity Sold (KG)',
        'Sale Price (GEL/KG)',
        'Total Revenue (GEL)',
        'Direct LLC Deposit (GEL)',
        'Cash / Other Channel (GEL)',
        'Buyer / Counterparty',
        'Sale Status',
        'Date'
    ];

    let totalSoldKg = 0;
    let totalRevenue = 0;
    let totalLLCDeposit = 0;
    let totalCash = 0;

    const rows: any[][] = [];

    produceItems.forEach(item => {
        const soldKg = Number((item as any).soldWeight || (item as any).totalSold || 0);
        const salePrice = Number((item as any).sellingPrice || (item as any).salePrice || (item as any).price || item.unitCost || 0);
        const revenue = Number((item as any).totalRevenue || (soldKg * salePrice) || 0);
        const depositLLC = Number((item as any).depositLLC || 0);
        const cash = Math.max(0, revenue - depositLLC);

        if (soldKg > 0 || revenue > 0 || item.status === 'SOLD' || (item as any).soldDate) {
            totalSoldKg += soldKg;
            totalRevenue += revenue;
            totalLLCDeposit += depositLLC;
            totalCash += cash;

            rows.push([
                item.sku || item.id,
                item.name,
                (item as any).variety || 'Standard',
                Number(soldKg.toFixed(2)),
                Number(salePrice.toFixed(2)),
                Number(revenue.toFixed(2)),
                Number(depositLLC.toFixed(2)),
                Number(cash.toFixed(2)),
                (item as any).buyer || (item as any).customer || 'Local Market / Wholesale',
                item.status || 'COMPLETED',
                (item as any).soldDate ? new Date((item as any).soldDate).toLocaleDateString() : ((item as any).lastRestocked ? new Date((item as any).lastRestocked).toLocaleDateString() : '')
            ]);
        }
    });

    const summaryRows = [
        ['--- HARVEST SALES FINANCIAL SUMMARY ---', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL SALES:',
            `${rows.length} Records`,
            '',
            Number(totalSoldKg.toFixed(2)),
            totalSoldKg > 0 ? Number((totalRevenue / totalSoldKg).toFixed(2)) : 0,
            Number(totalRevenue.toFixed(2)),
            Number(totalLLCDeposit.toFixed(2)),
            Number(totalCash.toFixed(2)),
            '',
            '',
            ''
        ]
    ];

    return { title: 'Stock_Harvest_Sales', headers, rows, summaryRows };
}

/**
 * 11. Stock: Cold Storage / Refrigerator Management
 */
export function prepareColdStorageDetailedSheetData(items: InventoryItem[]) {
    const coldItems = items.filter(i => 
        i.category === 'Produce' && 
        (i.status === 'COLD_STORAGE' || i.status === 'IN_REFRIGERATOR' || (i.location && i.location.toLowerCase().includes('refrigerator')) || ((i as any).warehouse && (i as any).warehouse.toLowerCase().includes('cold')))
    );

    const headers = [
        'Lot / Pallet ID',
        'Produce Description',
        'Variety',
        'Stored Net Weight (KG)',
        'Storage Box Count',
        'Chamber / Room',
        'Target Temperature (°C)',
        'Intake Date',
        'Days in Refrigeration',
        'Weight Loss / Shrinkage (KG)',
        'Storage Condition',
        'Valuation (GEL)'
    ];

    let totalKg = 0;
    let totalBoxes = 0;
    let totalValuation = 0;

    const rows = coldItems.map(item => {
        const kg = Number(item.currentStock || (item as any).quantity || 0);
        const boxes = Number((item as any).boxes || 0);
        const unitCost = Number(item.unitCost || (item as any).costPerUnit || (item as any).price || 0);
        const val = kg * unitCost;

        totalKg += kg;
        totalBoxes += boxes;
        totalValuation += val;

        const intakeDate = (item as any).lastRestocked ? new Date((item as any).lastRestocked) : new Date();
        const daysInStorage = Math.max(0, Math.floor((Date.now() - intakeDate.getTime()) / (1000 * 60 * 60 * 24)));

        return [
            item.sku || item.id,
            item.name,
            (item as any).variety || 'Standard',
            Number(kg.toFixed(2)),
            boxes,
            (item as any).warehouse || item.location || 'Chamber 1',
            (item as any).targetTemp || '+2°C',
            intakeDate.toLocaleDateString(),
            daysInStorage,
            (item as any).shrinkageKg || 0,
            (item as any).condition || 'Optimal Preserved',
            Number(val.toFixed(2))
        ];
    });

    const summaryRows = [
        ['--- COLD STORAGE INVENTORY TOTALS ---', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL COLD STORAGE:',
            `${coldItems.length} Pallets/Lots`,
            '',
            Number(totalKg.toFixed(2)),
            totalBoxes,
            '',
            '',
            '',
            '',
            '',
            '',
            Number(totalValuation.toFixed(2))
        ]
    ];

    return { title: 'Stock_Cold_Storage', headers, rows, summaryRows };
}

/**
 * 12. Stock: Post-Harvest Archive
 */
export function preparePostHarvestArchiveDetailedSheetData(items: InventoryItem[]) {
    const archiveItems = items.filter(i => 
        i.category === 'Produce' && 
        (i.status === 'ARCHIVED' || i.status === 'COLD_STORAGE_RETURNED' || (i as any).isArchived)
    );

    const headers = [
        'Archive ID',
        'Batch Name',
        'Variety',
        'Initial Net KG',
        'Total Sold KG',
        'Realized Revenue (GEL)',
        'Direct Labor Cost (GEL)',
        'Net Realized Margin (GEL)',
        'Harvest Date',
        'Archive Date',
        'Notes / Post-Mortem'
    ];

    let totalArchivedKg = 0;
    let totalArchivedRevenue = 0;
    let totalMargin = 0;

    const rows = archiveItems.map(item => {
        const initKg = Number((item as any).initialWeight || item.currentStock || 0);
        const soldKg = Number((item as any).soldWeight || initKg);
        const rev = Number((item as any).totalRevenue || (soldKg * ((item as any).price || item.unitCost || 12)));
        const labor = Number((item as any).laborCost || 0);
        const margin = rev - labor;

        totalArchivedKg += initKg;
        totalArchivedRevenue += rev;
        totalMargin += margin;

        return [
            item.sku || item.id,
            item.name,
            (item as any).variety || 'Standard',
            Number(initKg.toFixed(2)),
            Number(soldKg.toFixed(2)),
            Number(rev.toFixed(2)),
            Number(labor.toFixed(2)),
            Number(margin.toFixed(2)),
            (item as any).harvestDate || ((item as any).lastRestocked ? new Date((item as any).lastRestocked).toLocaleDateString() : ''),
            (item as any).archivedDate || new Date().toLocaleDateString(),
            (item as any).archiveReason || 'Season End Archive'
        ];
    });

    const summaryRows = [
        ['--- POST-HARVEST ARCHIVE TOTALS ---', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL ARCHIVED:',
            `${archiveItems.length} Records`,
            '',
            Number(totalArchivedKg.toFixed(2)),
            '',
            Number(totalArchivedRevenue.toFixed(2)),
            '',
            Number(totalMargin.toFixed(2)),
            '',
            '',
            ''
        ]
    ];

    return { title: 'Stock_Post_Harvest_Archive', headers, rows, summaryRows };
}

/**
 * 13. Stock: Live Stock Ledger
 */
export function prepareLiveStockLedgerDetailedSheetData(
    stockTransactions: StockTransaction[] = [],
    items: InventoryItem[] = []
) {
    const headers = [
        'Transaction ID',
        'Date & Time',
        'Item Code / Name',
        'Movement Type (IN / OUT / DEDUCTION)',
        'Quantity Changed',
        'Unit of Measure',
        'Unit Price at Transaction (GEL)',
        'Total Cost / Valuation Impact (GEL)',
        'Stock Before',
        'Stock After',
        'Source Module / Reason',
        'Responsible Person',
        'Authorized By User',
        'Notes'
    ];

    let totalDeductionsCost = 0;
    let totalInCost = 0;

    const itemMap = new Map(items.map(i => [i.id, i]));

    const rows = stockTransactions.map(tx => {
        const item = itemMap.get(tx.itemId);
        const itemName = item?.name || tx.itemId;
        const qty = Number(tx.quantity || 0);
        const cost = Number(tx.totalCostCharged || (qty * (tx.unitPriceAtCharge || item?.unitCost || (item as any)?.costPerUnit || 0)));

        if (tx.type === 'DEDUCTION' || (tx.type as any) === 'OUT' || (tx as any).type === 'out') {
            totalDeductionsCost += cost;
        } else {
            totalInCost += cost;
        }

        return [
            tx.id,
            tx.date ? new Date(tx.date).toLocaleString() : '',
            itemName,
            tx.type,
            qty,
            tx.unitOfMeasure || item?.unitOfMeasure || (item as any)?.unit || 'Units',
            Number((tx.unitPriceAtCharge || item?.unitCost || (item as any)?.costPerUnit || 0).toFixed(2)),
            Number(cost.toFixed(2)),
            tx.stockBeforeCharge ?? '',
            tx.stockAfterCharge ?? '',
            tx.sourceModule || tx.reason || 'Manual Adjustment',
            tx.responsibleEmployeeName || '',
            tx.chargedByUserName || '',
            tx.note || ''
        ];
    });

    const summaryRows = [
        ['--- LIVE STOCK LEDGER AUDIT ---', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL MOVEMENTS:',
            `${stockTransactions.length} Transactions`,
            '',
            '',
            '',
            '',
            'Total Value Impact:',
            Number((totalInCost - totalDeductionsCost).toFixed(2)),
            '',
            '',
            '',
            '',
            '',
            ''
        ]
    ];

    return { title: 'Stock_Live_Ledger', headers, rows, summaryRows };
}

/**
 * 14. Stock: Agro Inputs (Fertilizers, Pesticides, Chemicals, Seeds)
 */
export function prepareAgroInputsDetailedSheetData(items: InventoryItem[]) {
    const agroCategories = ['Fertilizers', 'Pesticides', 'Chemicals', 'Bio-stimulants', 'Seeds'];
    const agroItems = items.filter(i => agroCategories.includes(i.category as any));

    const headers = [
        'SKU',
        'Product Name / პრეპარატი',
        'Category / კატეგორია',
        'Current Stock',
        'Unit',
        'Cost Per Unit (GEL)',
        'Total Valuation (GEL)',
        'Active Chemical Ingredient',
        'Storage Location',
        'Min Safety Threshold',
        'Reorder Status',
        'Supplier'
    ];

    let totalVal = 0;
    const rows = agroItems.map(item => {
        const stock = Number(item.currentStock || (item as any).quantity || 0);
        const cost = Number(item.unitCost || (item as any).costPerUnit || (item as any).price || 0);
        const val = stock * cost;
        totalVal += val;

        const minStock = item.minStockThreshold || (item as any).minStock || 0;

        return [
            item.sku || item.id,
            item.name,
            item.category,
            stock,
            item.unitOfMeasure || (item as any).unit || 'L / KG',
            Number(cost.toFixed(2)),
            Number(val.toFixed(2)),
            (item as any).activeIngredient || '',
            (item as any).warehouse || item.location || 'Agro-Chemical Warehouse',
            minStock,
            stock <= minStock ? 'REORDER REQUIRED' : 'NORMAL',
            (item as any).supplier || item.supplierId || ''
        ];
    });

    const summaryRows = [
        ['--- AGRO-INPUTS AUDIT SUMMARY ---', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL AGRO-INPUTS:',
            `${agroItems.length} Products`,
            '',
            '',
            '',
            '',
            Number(totalVal.toFixed(2)),
            '',
            '',
            '',
            '',
            ''
        ]
    ];

    return { title: 'Stock_Agro_Inputs', headers, rows, summaryRows };
}

/**
 * 15. Stock: Assets & Machinery
 */
export function prepareAssetsMachineryDetailedSheetData(machinery: Machinery[] = [], items: InventoryItem[] = []) {
    const assetItems = items.filter(i => ['Machinery', 'Fixed Assets', 'Tools'].includes(i.category as any));

    const headers = [
        'Asset ID',
        'Name / Equipment',
        'Type / Category',
        'Model / Brand',
        'Status',
        'Hourly Rate (GEL)',
        'Fuel Consumption (L/hr)',
        'Operating Hours',
        'Acquisition / Valuation (GEL)',
        'Assigned Operator',
        'Next Maintenance Date'
    ];

    let totalAssetValue = 0;

    const rows: any[][] = [];

    machinery.forEach(m => {
        const val = Number((m as any).valuation || (m as any).cost || 0);
        totalAssetValue += val;
        rows.push([
            m.id,
            m.name,
            m.type || 'Machinery',
            (m as any).brand || '',
            m.status || 'Active',
            Number((m.hourlyRate || 0).toFixed(2)),
            Number((m.fuelConsumption || 0).toFixed(2)),
            Number(((m as any).hoursOperated || 0).toFixed(1)),
            Number(val.toFixed(2)),
            (m as any).operatorName || '',
            (m as any).nextMaintenance || ''
        ]);
    });

    assetItems.forEach(item => {
        if (!machinery.some(m => m.id === item.id)) {
            const stock = Number(item.currentStock || 1);
            const cost = Number(item.unitCost || (item as any).costPerUnit || (item as any).price || 0);
            const val = stock * cost;
            totalAssetValue += val;

            rows.push([
                item.sku || item.id,
                item.name,
                item.category,
                '',
                'Active',
                0,
                0,
                0,
                Number(val.toFixed(2)),
                '',
                ''
            ]);
        }
    });

    const summaryRows = [
        ['--- ASSETS & MACHINERY PORTFOLIO ---', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL ASSETS:',
            `${rows.length} Units`,
            '',
            '',
            '',
            '',
            '',
            '',
            Number(totalAssetValue.toFixed(2)),
            '',
            ''
        ]
    ];

    return { title: 'Stock_Assets_Machinery', headers, rows, summaryRows };
}

/**
 * 16. Stock: Supplies (Packaging, Pallets, Fuel, Spare Parts)
 */
export function prepareSuppliesDetailedSheetData(items: InventoryItem[]) {
    const suppliesCategories = ['Packaging', 'Pallets', 'Fuel', 'Spare Parts', 'Construction', 'Consumables', 'Tools', 'Other'];
    const supplyItems = items.filter(i => suppliesCategories.includes(i.category as any));

    const headers = [
        'SKU',
        'Supply Description',
        'Category',
        'Quantity on Hand',
        'Unit of Measure',
        'Cost Per Unit (GEL)',
        'Total Valuation (GEL)',
        'Warehouse Shelf / Bin',
        'Minimum Threshold',
        'Reorder Status'
    ];

    let totalVal = 0;
    const rows = supplyItems.map(item => {
        const stock = Number(item.currentStock || (item as any).quantity || 0);
        const cost = Number(item.unitCost || (item as any).costPerUnit || (item as any).price || 0);
        const val = stock * cost;
        totalVal += val;

        const minStock = item.minStockThreshold || (item as any).minStock || 0;

        return [
            item.sku || item.id,
            item.name,
            item.category,
            stock,
            item.unitOfMeasure || (item as any).unit || 'Units',
            Number(cost.toFixed(2)),
            Number(val.toFixed(2)),
            (item as any).warehouse || item.location || 'Central Storage',
            minStock,
            stock <= minStock ? 'LOW SUPPLY' : 'OK'
        ];
    });

    const summaryRows = [
        ['--- GENERAL SUPPLIES AUDIT ---', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL SUPPLIES:',
            `${supplyItems.length} SKUs`,
            '',
            '',
            '',
            '',
            Number(totalVal.toFixed(2)),
            '',
            '',
            ''
        ]
    ];

    return { title: 'Stock_Supplies', headers, rows, summaryRows };
}

/**
 * 17. Stock: Purchase Orders (P. Orders)
 */
export function preparePurchaseOrdersDetailedSheetData(orders: PurchaseOrder[] = []) {
    const headers = [
        'Order Number',
        'Supplier Name',
        'Order Date',
        'Delivery Date',
        'Status',
        'Items Count',
        'Subtotal (GEL)',
        'Tax / Fee (GEL)',
        'Grand Total (GEL)',
        'Payment Status',
        'Created By'
    ];

    let totalOrdersVal = 0;

    const rows = orders.map(po => {
        const total = Number((po as any).totalAmount || po.totalCost || 0);
        totalOrdersVal += total;

        const orderDateStr = (po as any).orderDate || po.date;
        const deliveryDateStr = (po as any).expectedDeliveryDate;

        return [
            (po as any).orderNumber || po.id,
            po.supplierName || (po as any).supplier || 'Supplier',
            orderDateStr ? new Date(orderDateStr).toLocaleDateString() : '',
            deliveryDateStr ? new Date(deliveryDateStr).toLocaleDateString() : '',
            po.status || 'Pending',
            po.items?.length || 0,
            Number(((po as any).subtotal || total).toFixed(2)),
            Number(((po as any).tax || 0).toFixed(2)),
            Number(total.toFixed(2)),
            (po as any).paymentStatus || 'Pending Payment',
            (po as any).createdBy || 'Purchasing Department'
        ];
    });

    const summaryRows = [
        ['--- PURCHASE ORDERS SUMMARY ---', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL ORDERS:',
            `${orders.length} P.O. Records`,
            '',
            '',
            '',
            '',
            '',
            '',
            Number(totalOrdersVal.toFixed(2)),
            '',
            ''
        ]
    ];

    return { title: 'Stock_Purchase_Orders', headers, rows, summaryRows };
}

/**
 * 18. Stock: Supplier Directory
 */
export function prepareSupplierDirectoryDetailedSheetData(suppliers: Supplier[] = []) {
    const headers = [
        'Supplier ID',
        'Company Name / კომპანია',
        'Contact Person',
        'Phone Number',
        'Email Address',
        'Physical Address',
        'Tax Identification Code (ს/ნ)',
        'Categories Supplied',
        'Payment Terms',
        'Notes'
    ];

    const rows = suppliers.map(s => [
        s.id,
        s.name,
        s.contactPerson || '',
        s.phone || '',
        s.email || '',
        (s as any).address || '',
        (s as any).taxId || (s as any).taxNumber || '',
        Array.isArray((s as any).categories) ? (s as any).categories.join(', ') : ((s as any).category || 'All'),
        (s as any).paymentTerms || 'Bank Transfer (30 Days)',
        (s as any).notes || ''
    ]);

    const summaryRows = [
        ['--- SUPPLIERS DIRECTORY ---', '', '', '', '', '', '', '', '', ''],
        ['TOTAL REGISTERED SUPPLIERS:', `${suppliers.length} Vendors`, '', '', '', '', '', '', '', '']
    ];

    return { title: 'Stock_Supplier_Directory', headers, rows, summaryRows };
}

/**
 * 19. Stock: Direct Charges
 */
export function prepareDirectChargesDetailedSheetData(
    stockTransactions: StockTransaction[] = [],
    items: InventoryItem[] = []
) {
    const directCharges = stockTransactions.filter(tx => 
        tx.sourceModule === 'DIRECT_CHARGE' || 
        tx.type === 'DEDUCTION' || 
        tx.chargeCategory
    );

    const headers = [
        'Charge ID',
        'Date & Time',
        'Item Charged / მასალა',
        'Deducted Amount',
        'Unit of Measure',
        'Unit Price at Charge (GEL)',
        'Total Cost Charged (GEL)',
        'Charge Category / დანიშნულება',
        'Responsible Employee',
        'Charged By User',
        'Stock Before',
        'Stock After',
        'Notes / ოპერაცია'
    ];

    let totalChargesCost = 0;
    const itemMap = new Map(items.map(i => [i.id, i]));

    const rows = directCharges.map(tx => {
        const item = itemMap.get(tx.itemId);
        const itemName = item?.name || tx.itemId;
        const qty = Number(tx.quantity || 0);
        const unitCost = Number(tx.unitPriceAtCharge || item?.unitCost || (item as any)?.costPerUnit || 0);
        const cost = Number(tx.totalCostCharged || (qty * unitCost));
        totalChargesCost += cost;

        return [
            tx.id,
            tx.date ? new Date(tx.date).toLocaleString() : '',
            itemName,
            qty,
            tx.unitOfMeasure || item?.unitOfMeasure || (item as any)?.unit || 'Units',
            Number(unitCost.toFixed(2)),
            Number(cost.toFixed(2)),
            tx.chargeCategory || tx.reason || 'General Direct Charge',
            tx.responsibleEmployeeName || '',
            tx.chargedByUserName || '',
            tx.stockBeforeCharge ?? '',
            tx.stockAfterCharge ?? '',
            tx.note || ''
        ];
    });

    const summaryRows = [
        ['--- DIRECT STOCK CHARGES AUDIT ---', '', '', '', '', '', '', '', '', '', '', '', ''],
        [
            'TOTAL DIRECT CHARGES:',
            `${directCharges.length} Charges Logged`,
            '',
            '',
            '',
            '',
            Number(totalChargesCost.toFixed(2)),
            '',
            '',
            '',
            '',
            '',
            ''
        ]
    ];

    return { title: 'Stock_Direct_Charges', headers, rows, summaryRows };
}
