const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

// 1. Remove CropVariety
file = file.replace(/CropVariety, /, '');

// 2. Fix quantity -> currentStock
file = file.replace(/invItem\.quantity - diff/g, 'invItem.currentStock - diff');

// 3. Fix currency type
file = file.replace(/const currency = "USD";/, 'const currency = "USD" as string;');

// 4. Fix assignedVehicles
file = file.replace(/\{ name: newVehicleName\.trim\(\), hiredCost: cost, isOwned: cost === 0, usageHours: 0 \}/g, "{ id: 'vh-' + Date.now(), name: newVehicleName.trim(), machineryId: newVehicleName.trim(), hiredCost: cost, isOwned: cost === 0, usageHours: 0 }");

// 5. Fix WorkerLog
file = file.replace(/const WorkerLog: React\.FC<any> = \(\) => <div \/>;/, "import { WorkerLog } from '../../../new_engine/WorkerLogBridge';");
file = file.replace(/WorkerLog\(\n\s*'REACTIVATE_HARVEST_SEASON',/, "WorkerLog.appendDelta(\n                                        'REACTIVATE_HARVEST_SEASON',");

// 6. Fix onSetHarvestLogs
file = file.replace(/const onSetHarvestLogs = \(\) => \{\};/, "const onSetHarvestLogs = (param: any) => {};");

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
