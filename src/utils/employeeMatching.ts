import type { Employee } from '../types';

/**
 * Robust, universal worker identifier matcher.
 * Matches physical barcode/QR scans, manual keystrokes, numeric badges, Georgian national IDs,
 * formatted prefixes (ID:, EMP-, BC-), stripped spaces, and name-embedded numbers.
 */
export const findMatchingEmployee = (employees: Employee[] | undefined, rawInput: string | undefined | null): Employee | undefined => {
    if (!employees || employees.length === 0 || !rawInput) return undefined;
    
    let raw = String(rawInput).trim();
    if (!raw) return undefined;

    // 0. JSON payload extraction (e.g. badges generated with { id, name, role })
    let extractedNameFromJson = '';
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (parsed.name) extractedNameFromJson = String(parsed.name).trim();
                const jsonId = parsed.id || parsed.employeeId || parsed.workerId || parsed.barcode || parsed.idNumber || parsed.code || parsed.badgeId;
                if (jsonId) {
                    raw = String(jsonId).trim();
                } else if (parsed.name) {
                    raw = String(parsed.name).trim();
                }
            }
        } catch (_) {}
    }

    // 1. URL extraction if scanned code is a URL (e.g., https://agrimap.pro/worker?id=16)
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        try {
            const url = new URL(raw);
            const extracted = url.searchParams.get('id') || 
                              url.searchParams.get('workerId') || 
                              url.searchParams.get('employeeId') || 
                              url.searchParams.get('code') || 
                              url.searchParams.get('barcode');
            if (extracted) {
                raw = extracted.trim();
            }
        } catch (e) {}
    }

    // 2. Strip common scanner / badge prefixes
    let cleanCode = raw;
    const prefixes = [
        'WORKER ID:', 'WORKER ID ', 'WORKER ID-', 'WORKER ID',
        'WORKER:', 'WORKER ', 'WORKER-',
        'ID:', 'ID ', 'ID-',
        'BC:', 'BC ', 'BC-',
        'EMP:', 'EMP ', 'EMP-',
        'QR:', 'QR ', 'QR-',
        'PRE_BIND_'
    ];
    let changed = true;
    while (changed) {
        changed = false;
        for (const prefix of prefixes) {
            if (cleanCode.toUpperCase().startsWith(prefix.toUpperCase())) {
                cleanCode = cleanCode.substring(prefix.length).trim();
                changed = true;
                break;
            }
        }
    }

    const lowerCode = cleanCode.toLowerCase();
    const noSpacesCode = lowerCode.replace(/[\s\-_:]/g, '');
    const digitsOnly = cleanCode.replace(/\D/g, '');

    // 1. Direct exact matches (case-insensitive)
    let found = employees.find(e => {
        if (!e) return false;
        return (
            (e.id && e.id.toLowerCase() === lowerCode) ||
            (e.barcode && e.barcode.toLowerCase() === lowerCode) ||
            (e.idNumber && e.idNumber.toLowerCase() === lowerCode) ||
            (e.employeeCodeOverride && e.employeeCodeOverride.toLowerCase() === lowerCode) ||
            (e.hardwareCredentials?.serialNumber && e.hardwareCredentials.serialNumber.toLowerCase() === lowerCode) ||
            (e.name && e.name.toLowerCase() === lowerCode)
        );
    });
    if (found) return found;

    // 2. Spaces and punctuation stripped matches (handles "33 00 10 27 140" vs "33001027140")
    found = employees.find(e => {
        if (!e) return false;
        const eId = (e.id || '').toLowerCase().replace(/[\s\-_:]/g, '');
        const eBarcode = (e.barcode || '').toLowerCase().replace(/[\s\-_:]/g, '');
        const eIdNum = (e.idNumber || '').toLowerCase().replace(/[\s\-_:]/g, '');
        const eOverride = (e.employeeCodeOverride || '').toLowerCase().replace(/[\s\-_:]/g, '');
        const eNfc = (e.hardwareCredentials?.serialNumber || '').toLowerCase().replace(/[\s\-_:]/g, '');
        const eName = (e.name || '').toLowerCase().replace(/[\s\-_:]/g, '');

        return (
            (eId && eId === noSpacesCode) ||
            (eBarcode && eBarcode === noSpacesCode) ||
            (eIdNum && eIdNum === noSpacesCode) ||
            (eOverride && eOverride === noSpacesCode) ||
            (eNfc && eNfc === noSpacesCode) ||
            (eName && eName === noSpacesCode)
        );
    });
    if (found) return found;

    // 3. Numeric-only match for national IDs or short badge IDs (e.g. "16", "11", "330010153710")
    if (digitsOnly.length >= 1) {
        found = employees.find(e => {
            if (!e) return false;
            const eIdNumOnly = (e.idNumber || '').replace(/\D/g, '');
            const eBarcodeNumOnly = (e.barcode || '').replace(/\D/g, '');
            const eIdNumOnlyField = (e.id || '').replace(/\D/g, '');
            const eOverrideNumOnly = (e.employeeCodeOverride || '').replace(/\D/g, '');

            // Exact match on numeric ID
            if (eIdNumOnly && eIdNumOnly === digitsOnly) return true;
            if (eBarcodeNumOnly && eBarcodeNumOnly === digitsOnly) return true;
            if (eOverrideNumOnly && eOverrideNumOnly === digitsOnly) return true;
            if (eIdNumOnlyField && eIdNumOnlyField === digitsOnly) return true;

            // Short worker badge check in name (e.g. Name: "ამბროლაძე ია 16", scanned: "16")
            if (digitsOnly.length <= 4) {
                const nameParts = (e.name || '').split(/\s+/);
                if (nameParts.some(p => p === digitsOnly)) return true;
            }

            // Long national ID partial match (Georgian 11-digit IDs)
            if (digitsOnly.length >= 9 && eIdNumOnly.length >= 9) {
                if (eIdNumOnly.includes(digitsOnly) || digitsOnly.includes(eIdNumOnly)) return true;
            }

            return false;
        });
        if (found) return found;
    }

    // 4. Substring, name contains, and multi-word token match
    found = employees.find(e => {
        if (!e) return false;
        const eId = (e.id || '').toLowerCase();
        const eBarcode = (e.barcode || '').toLowerCase();
        const eIdNum = (e.idNumber || '').toLowerCase();
        const eOverride = (e.employeeCodeOverride || '').toLowerCase();
        const eName = (e.name || '').toLowerCase();

        // Direct token or contains check on IDs
        if (eId && (lowerCode.includes(eId) || (eId.length >= 4 && eId.includes(lowerCode)))) return true;
        if (eBarcode && (lowerCode.includes(eBarcode) || (eBarcode.length >= 4 && eBarcode.includes(lowerCode)))) return true;
        if (eIdNum && (lowerCode.includes(eIdNum) || (eIdNum.length >= 4 && eIdNum.includes(lowerCode)))) return true;
        if (eOverride && (lowerCode.includes(eOverride) || (eOverride.length >= 4 && eOverride.includes(lowerCode)))) return true;

        // If whole employee name is contained in the scanned string (e.g. "scaned მახარაძე მელანო 122 ...")
        if (eName && eName.length >= 3 && (lowerCode.includes(eName) || eName.includes(lowerCode))) return true;

        // If employee name has multiple words (e.g. "მახარაძე მელანო"), check if all name words appear in lowerCode
        if (eName) {
            const nameWords = eName.split(/\s+/).filter(w => w.length >= 3);
            if (nameWords.length >= 2 && nameWords.every(w => lowerCode.includes(w))) {
                return true;
            }
        }

        // Check if individual tokens in lowerCode match the employee's ID, barcode, or idNumber
        const tokens = lowerCode.split(/[\s,;:|/_-]+/).filter(t => t.length >= 2);
        for (const token of tokens) {
            if (eId && eId === token) return true;
            if (eBarcode && eBarcode === token) return true;
            if (eIdNum && eIdNum === token) return true;
            if (eOverride && eOverride === token) return true;
            const tokenDigits = token.replace(/\D/g, '');
            if (tokenDigits && tokenDigits === digitsOnly) {
                if (eIdNum && eIdNum.replace(/\D/g, '') === tokenDigits) return true;
                if (eBarcode && eBarcode.replace(/\D/g, '') === tokenDigits) return true;
            }
        }

        return false;
    });
    if (found) return found;

    // 5. Fallback match on extractedNameFromJson
    if (extractedNameFromJson) {
        const lowerJsonName = extractedNameFromJson.toLowerCase();
        found = employees.find(e => e.name && e.name.toLowerCase() === lowerJsonName);
    }

    return found;
};
