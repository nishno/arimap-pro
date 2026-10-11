import type { Employee, InventoryItem } from '../types';
import { findMatchingEmployee } from './employeeMatching';

export type ScannerCategory = 'auto' | 'worker' | 'harvest_box' | 'assets' | 'supplies' | 'goods' | 'document' | 'material';

export interface ParsedMaterialScan {
    materialId?: string;
    materialName?: string;
    sku?: string;
    category: 'assets' | 'supplies' | 'goods' | 'document';
    quantity: number;
    unit: string;
    batchId?: string;
    action?: 'add' | 'charge';
    item?: InventoryItem;
}

export interface ParsedHarvestBoxScan {
    crateCode: string;
    uniqueCode?: string;
    weight?: number;
    tare?: number;
    variety?: string;
    pickerId?: string;
    pickerName?: string;
    harvestEventId?: string;
    harvestEventName?: string;
    boxNumber?: number;
    totalBoxes?: number;
}

export interface ParsedScanResult {
    raw: string;
    detectedType: 'worker' | 'material' | 'harvest_box' | 'document' | 'unknown';
    category: ScannerCategory;
    employee?: Employee;
    material?: ParsedMaterialScan;
    harvestBox?: ParsedHarvestBoxScan;
    documentData?: {
        docNumber?: string;
        docType?: string;
        date?: string;
        notes?: string;
    };
    summary: string;
}

/**
 * Universal Scanner Parser
 * Parses any incoming barcode/QR scan from Camera, USB/Bluetooth HID wedges, file uploads, or manual text.
 * Supports JSON payloads, structured URL parameters, standard prefixes, and plain ID strings.
 */
export function parseUniversalScan(
    rawInput: string | undefined | null,
    employees: Employee[] = [],
    inventoryItems: InventoryItem[] = [],
    forcedCategory: ScannerCategory = 'auto',
    defaultAction: 'add' | 'charge' = 'charge'
): ParsedScanResult {
    const raw = String(rawInput || '').trim();
    if (!raw) {
        return {
            raw: '',
            detectedType: 'unknown',
            category: forcedCategory,
            summary: 'Empty scan data'
        };
    }

    // Try parsing as JSON first
    let jsonPayload: any = null;
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
        try {
            jsonPayload = JSON.parse(raw);
        } catch (_) {
            jsonPayload = null;
        }
    }

    // 1. Harvest Box / Crate Detection from JSON (Prioritized over generic worker ID check)
    if (jsonPayload && (
        jsonPayload.type === 'harvest_box' ||
        jsonPayload.type === 'crate' ||
        jsonPayload.crateCode ||
        jsonPayload.boxId ||
        jsonPayload.uniqueCode
    )) {
        const uCode = jsonPayload.uniqueCode || jsonPayload.crateCode || jsonPayload.boxId || jsonPayload.id;
        const wId = jsonPayload.workerId || jsonPayload.pickerId;
        const wName = jsonPayload.workerName || jsonPayload.pickerName;
        const matchedWorker = (wId ? findMatchingEmployee(employees, wId) : undefined) ||
                              (wName ? findMatchingEmployee(employees, wName) : undefined) ||
                              (wId || wName ? ({
                                  id: wId || `emp-${Date.now()}`,
                                  name: wName || 'Mapped Worker',
                                  barcode: wId || '',
                                  idNumber: wId || '',
                                  employeeCodeOverride: wId || '',
                                  employeeType: 'Picker',
                                  roleId: 'Picker',
                                  paymentType: 'per_weight',
                                  paymentRate: 0.4,
                                  status: 'Active'
                              } as unknown as Employee) : undefined);

        return {
            raw,
            detectedType: 'harvest_box',
            category: 'harvest_box',
            employee: matchedWorker,
            harvestBox: {
                crateCode: uCode,
                uniqueCode: uCode,
                weight: Number(jsonPayload.targetWeightKg || jsonPayload.weight || jsonPayload.grossWeight || 5.8),
                tare: Number(jsonPayload.tare || 0.4),
                variety: jsonPayload.variety,
                pickerId: matchedWorker?.id || wId,
                pickerName: matchedWorker?.name || wName,
                harvestEventId: jsonPayload.harvestEventId || jsonPayload.eventId,
                harvestEventName: jsonPayload.harvestEventName || jsonPayload.eventName,
                boxNumber: jsonPayload.boxNumber,
                totalBoxes: jsonPayload.totalBoxes
            },
            summary: `Harvest Crate #${jsonPayload.boxNumber || ''}: ${uCode}${matchedWorker ? ` (${matchedWorker.name})` : ''}`
        };
    }

    // 2. Material / Agro-input Detection from JSON
    if (jsonPayload && (
        jsonPayload.type === 'material' ||
        jsonPayload.type === 'agro_input' ||
        jsonPayload.type === 'inventory' ||
        jsonPayload.materialId ||
        jsonPayload.sku ||
        jsonPayload.batch ||
        jsonPayload.batchId ||
        (jsonPayload.quantity !== undefined && jsonPayload.name)
    )) {
        const cat: 'assets' | 'supplies' | 'goods' | 'document' = 
            ['assets', 'supplies', 'goods', 'document'].includes(jsonPayload.category) 
                ? jsonPayload.category 
                : (forcedCategory !== 'auto' && ['assets', 'supplies', 'goods', 'document'].includes(forcedCategory) 
                    ? (forcedCategory as any) 
                    : 'supplies');

        const matId = jsonPayload.materialId || jsonPayload.id || jsonPayload.sku;
        const matchedItem = inventoryItems.find(i => 
            (matId && (i.id === matId || (i as any).sku === matId || (i as any).barcode === matId)) ||
            (jsonPayload.name && i.name.toLowerCase() === jsonPayload.name.toLowerCase())
        );

        return {
            raw,
            detectedType: 'material',
            category: cat,
            material: {
                materialId: matchedItem?.id || matId || `mat-${Date.now()}`,
                materialName: jsonPayload.name || matchedItem?.name || 'Agro-input / Material',
                sku: jsonPayload.sku || (matchedItem as any)?.sku || matId,
                category: cat,
                quantity: Number(jsonPayload.quantity || jsonPayload.qty || 1),
                unit: jsonPayload.unit || (matchedItem as any)?.unit || 'kg',
                batchId: jsonPayload.batchId || jsonPayload.batch || jsonPayload.lot,
                action: jsonPayload.action || defaultAction,
                item: matchedItem
            },
            summary: `Material: ${jsonPayload.name || matchedItem?.name || matId} (${jsonPayload.quantity || 1} ${jsonPayload.unit || 'kg'})`
        };
    }

    // 3. Worker Detection from JSON
    // Check if JSON explicitly declares a worker, or contains employee properties
    if (jsonPayload && (
        jsonPayload.type === 'worker' || 
        jsonPayload.type === 'employee' ||
        jsonPayload.workerId ||
        jsonPayload.employeeId ||
        (jsonPayload.role && jsonPayload.name) ||
        (jsonPayload.id && employees.some(e => e.id === jsonPayload.id || e.barcode === jsonPayload.id || e.idNumber === jsonPayload.id))
    )) {
        const empSearchStr = jsonPayload.id || jsonPayload.employeeId || jsonPayload.workerId || jsonPayload.barcode || jsonPayload.idNumber || jsonPayload.name;
        const matchedEmp = findMatchingEmployee(employees, empSearchStr) || 
                           employees.find(e => e.name && jsonPayload.name && e.name.toLowerCase() === jsonPayload.name.toLowerCase());
        
        return {
            raw,
            detectedType: 'worker',
            category: 'worker',
            employee: matchedEmp || ({
                id: jsonPayload.id || jsonPayload.employeeId || `emp-${Date.now()}`,
                name: jsonPayload.name || 'Scanned Worker',
                employeeType: jsonPayload.role || 'Field Worker'
            } as any),
            summary: matchedEmp ? `Worker: ${matchedEmp.name}` : `Worker ID: ${jsonPayload.name || jsonPayload.id}`
        };
    }

    // 4. Document Detection from JSON
    if (jsonPayload && (jsonPayload.type === 'document' || jsonPayload.docNumber || jsonPayload.waybill)) {
        return {
            raw,
            detectedType: 'document',
            category: 'document',
            documentData: {
                docNumber: jsonPayload.docNumber || jsonPayload.waybill || jsonPayload.id,
                docType: jsonPayload.docType || 'Waybill / Invoice',
                date: jsonPayload.date || new Date().toISOString(),
                notes: jsonPayload.notes
            },
            summary: `Document: ${jsonPayload.docNumber || jsonPayload.waybill}`
        };
    }

    // --- Non-JSON (Plain text / URL / Barcodes) ---

    // Worker Badge / Georgian Harvest String Pattern Check
    // e.g. "scaned მახარაძე მელანო 122 picker, harvest event july harvesting"
    const workerTextPattern = /^(?:scaned|scanned|სკანირებულია|worker:?)\s*([^\d,]+?)\s*(\d+)\s*(?:picker|მკრეფავი|worker)?\s*(?:,\s*(?:harvest event|event|ღონისძიება)?\s*([^,]+))?$/i;
    const workerMatch = raw.match(workerTextPattern);
    if (workerMatch) {
        const extractedName = workerMatch[1].trim();
        const extractedCode = workerMatch[2].trim();
        const extractedEvent = workerMatch[3]?.trim();
        const matched = findMatchingEmployee(employees, extractedCode) || 
                        findMatchingEmployee(employees, extractedName) ||
                        employees.find(e => e.name.toLowerCase().includes(extractedName.toLowerCase()));

        const workerObj: Employee = matched || ({
            id: `emp-${extractedCode}`,
            name: extractedName,
            barcode: extractedCode,
            idNumber: extractedCode,
            employeeCodeOverride: extractedCode,
            employeeType: 'Picker',
            roleId: 'Picker',
            paymentType: 'per_weight',
            paymentRate: 0.4,
            status: 'Active'
        } as any);

        return {
            raw,
            detectedType: 'worker',
            category: 'worker',
            employee: workerObj,
            harvestBox: extractedEvent ? {
                crateCode: '',
                pickerId: workerObj.id,
                pickerName: workerObj.name,
                harvestEventName: extractedEvent
            } : undefined,
            summary: `სკანირებულია ${workerObj.name} ${extractedCode} picker${extractedEvent ? `, harvest event ${extractedEvent}` : ''}`
        };
    }

    // A. If forced to worker or matches worker list
    const matchedEmployee = findMatchingEmployee(employees, raw);
    if (matchedEmployee && (forcedCategory === 'worker' || forcedCategory === 'auto')) {
        return {
            raw,
            detectedType: 'worker',
            category: 'worker',
            employee: matchedEmployee,
            summary: `Worker: ${matchedEmployee.name} (${matchedEmployee.idNumber || matchedEmployee.id})`
        };
    }

    // B. Check if matches Inventory Item (by SKU, Barcode, ID, or Name)
    const lowerRaw = raw.toLowerCase();
    const cleanRaw = raw.replace(/^(MAT:|SKU:|ITEM:|PROD:)/i, '').trim();
    const matchedInventory = inventoryItems.find(i => 
        i.id.toLowerCase() === lowerRaw ||
        i.id.toLowerCase() === cleanRaw.toLowerCase() ||
        ((i as any).sku && String((i as any).sku).toLowerCase() === lowerRaw) ||
        ((i as any).sku && String((i as any).sku).toLowerCase() === cleanRaw.toLowerCase()) ||
        ((i as any).barcode && String((i as any).barcode).toLowerCase() === lowerRaw) ||
        ((i as any).barcode && String((i as any).barcode).toLowerCase() === cleanRaw.toLowerCase()) ||
        i.name.toLowerCase() === lowerRaw
    );

    if (matchedInventory && (forcedCategory === 'material' || forcedCategory === 'supplies' || forcedCategory === 'assets' || forcedCategory === 'goods' || forcedCategory === 'auto')) {
        // Derive category from item category if available
        let itemCat: 'assets' | 'supplies' | 'goods' | 'document' = 'supplies';
        const rawCat = ((matchedInventory as any).category || '').toLowerCase();
        if (rawCat.includes('asset') || rawCat.includes('tool') || rawCat.includes('machin')) itemCat = 'assets';
        else if (rawCat.includes('good') || rawCat.includes('product') || rawCat.includes('harvest')) itemCat = 'goods';
        else if (rawCat.includes('doc')) itemCat = 'document';

        return {
            raw,
            detectedType: 'material',
            category: forcedCategory !== 'auto' && ['assets', 'supplies', 'goods', 'document'].includes(forcedCategory) ? (forcedCategory as any) : itemCat,
            material: {
                materialId: matchedInventory.id,
                materialName: matchedInventory.name,
                sku: (matchedInventory as any).sku || matchedInventory.id,
                category: itemCat,
                quantity: 1,
                unit: (matchedInventory as any).unit || 'kg',
                action: defaultAction,
                item: matchedInventory
            },
            summary: `Inventory Item: ${matchedInventory.name}`
        };
    }

    // C. Check if matches Crate / Box pattern
    const upperRaw = raw.toUpperCase();
    if (
        forcedCategory === 'harvest_box' ||
        upperRaw.startsWith('HV-BOX-') ||
        upperRaw.startsWith('BX-') ||
        upperRaw.startsWith('BOX-') || 
        upperRaw.startsWith('CRATE-') || 
        upperRaw.startsWith('BIN-') || 
        upperRaw.startsWith('PLT-') ||
        upperRaw.startsWith('PALLET-') ||
        upperRaw.startsWith('HARVEST-')
    ) {
        return {
            raw,
            detectedType: 'harvest_box',
            category: 'harvest_box',
            harvestBox: {
                crateCode: raw,
                weight: 5.9,
                tare: 0.4
            },
            summary: `Harvest Crate: ${raw}`
        };
    }

    // D. If forced category is specified, return typed result even for generic input
    if (forcedCategory === 'worker') {
        return {
            raw,
            detectedType: 'worker',
            category: 'worker',
            employee: matchedEmployee,
            summary: matchedEmployee ? `Worker: ${matchedEmployee.name}` : `Worker ID: ${raw}`
        };
    }

    if (['supplies', 'assets', 'goods', 'document', 'material'].includes(forcedCategory)) {
        const cat: 'assets' | 'supplies' | 'goods' | 'document' = forcedCategory === 'material' ? 'supplies' : (forcedCategory as any);
        return {
            raw,
            detectedType: forcedCategory === 'document' ? 'document' : 'material',
            category: cat,
            material: {
                materialId: `scan-${Date.now()}`,
                materialName: raw,
                category: cat,
                quantity: 1,
                unit: 'pcs',
                action: defaultAction
            },
            summary: `${cat.toUpperCase()}: ${raw}`
        };
    }

    // Default fallback
    return {
        raw,
        detectedType: matchedEmployee ? 'worker' : 'unknown',
        category: forcedCategory,
        employee: matchedEmployee,
        summary: matchedEmployee ? `Worker: ${matchedEmployee.name}` : `Scanned Code: ${raw}`
    };
}
