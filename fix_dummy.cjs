const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(/import HarvestLocalSyncPanel from '\.\/HarvestLocalSyncPanel';\n/, '');
file = file.replace(/import OperationLogWidget from '\.\/OperationLogWidget';\n/, '');
file = file.replace(/import CloseHarvestModal from '\.\/CloseHarvestModal';\n/, '');
file = file.replace(/import DailyHarvestModal from '\.\/DailyHarvestModal';\n/, '');
file = file.replace(/import BoxScannerOverlay from '\.\/BoxScannerOverlay';\n/, '');

// Add WeighStationModal and HarvestLogModal correct paths
file = file.replace(/import WeighStationModal from '\.\/WeighStationModal';\n/, "import WeighStationModal from '../WeighStationModal';\n");
file = file.replace(/import HarvestLogModal from '\.\/HarvestLogModal';\n/, "import HarvestLogModal from '../HarvestLogModal';\n");


// Add dummies
const dummies = `
const HarvestLocalSyncPanel: React.FC<any> = () => null;
const OperationLogWidget: React.FC<any> = () => null;
const CloseHarvestModal: React.FC<any> = () => null;
const DailyHarvestModal: React.FC<any> = () => null;
const BoxScannerOverlay: React.FC<any> = () => null;
`;

file = file.replace(/const ArchiveBoxIcon/, dummies + "\nconst ArchiveBoxIcon");

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
