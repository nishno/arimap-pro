const fs = require('fs');
let file = fs.readFileSync('src/components/HarvestingStats.tsx', 'utf8');

const newFunc = `
export const calculateTotalOpex = (event: HarvestEvent, entries: HarvestEntry[], durationHours: number, machinery: Machinery[]): { laborCost: number, machineCost: number, packagingCost: number, otherCosts: number, totalCost: number } => {
    const laborCost = (event.assignedPickers || []).reduce((acc, picker) => {
        const pickerEntries = (entries || []).filter(e => String(e.employeeId) === String(picker.employeeId));
        const weight = picker.manualNetWeight ?? pickerEntries.reduce((sum, e) => sum + (e.netWeightKg || 0), 0);
        const effectiveHours = picker.manualHours ?? durationHours;
        return acc + calculatePickerEarnings(picker, weight, effectiveHours);
    }, 0);

    const machineCost = (event.assignedVehicles || []).reduce((acc, v) => {
        const machineDetails = (machinery || []).find(m => m.id === v.machineryId);
        const rate = v.isOwned ? (machineDetails?.hourlyRate || 0) : v.hiredCost;
        return acc + ((v.usageHours || 0) * rate);
    }, 0);

    let fullBoxes = 0;
    let halfBoxes = 0;
    let totalPunets = 0;
    (entries || []).forEach(e => {
        if (!e) return;
        const entryPunets = e.punets ?? e.punetCount;
        if (e.isHalfBox) {
            const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
            halfBoxes += count;
            totalPunets += (entryPunets !== undefined ? entryPunets : Math.round(count * ((event.punetsPerBox || 12) / 2)));
        } else {
            const count = typeof e.boxCount === 'number' && !isNaN(e.boxCount) ? e.boxCount : 1;
            fullBoxes += count;
            totalPunets += (entryPunets !== undefined ? entryPunets : Math.round(count * (event.punetsPerBox || 12)));
        }
    });
    
    let totalBoxesVal = 0;
    if (event.totalBoxes && event.totalBoxes > 0) totalBoxesVal = event.totalBoxes;
    else if (fullBoxes > 0 || halfBoxes > 0) totalBoxesVal = fullBoxes + halfBoxes;
    
    const punetsPerBoxVal = event.punetsPerBox || 12;
    let totalPunetsVal = 0;
    if (totalPunets > 0) {
        totalPunetsVal = totalPunets;
    } else if (event.totalPunets && event.totalPunets >= totalBoxesVal) {
        totalPunetsVal = event.totalPunets;
    } else if (event.physicalPunets && event.physicalPunets >= totalBoxesVal) {
        totalPunetsVal = event.physicalPunets;
    } else {
        totalPunetsVal = totalBoxesVal * punetsPerBoxVal;
    }

    const boxUnitCost = event.boxUnitCost ?? 0.8;
    const punetUnitCost = event.punetUnitCost ?? 0.15;
    const usedBoxesCost = totalBoxesVal * boxUnitCost;
    const usedPunetsCost = totalPunetsVal * punetUnitCost;
    const packagingCost = usedBoxesCost + usedPunetsCost;

    const otherCosts = (event.otherOpexItems || []).reduce((sum, item) => sum + (item.cost || 0), 0);

    const totalCost = (event.manualOpex ?? laborCost) + (event.manualVehicleCost ?? machineCost) + packagingCost + otherCosts;
    return { laborCost: (event.manualOpex ?? laborCost), machineCost: (event.manualVehicleCost ?? machineCost), packagingCost, otherCosts, totalCost };
};

export const calculatePickerEarnings`;

file = file.replace('export const calculatePickerEarnings', newFunc);
fs.writeFileSync('src/components/HarvestingStats.tsx', file);
