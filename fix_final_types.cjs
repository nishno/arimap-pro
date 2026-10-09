const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

file = file.replace(/from '\.\.\/\.\.\/\.\.\/types';/, "from '../../types';");
file = file.replace(/from '\.\.\/\.\.\/\.\.\/contexts\/LanguageContext';/, "from '../../contexts/LanguageContext';");

file = file.replace(/import OperationLogModal from '\.\/OperationLogModal';/, "import { OperationLogModal } from './OperationLogModal';");

file = file.replace(/const ArchiveBoxIcon = \(\) => <div \/>;/, "const ArchiveBoxIcon: React.FC<any> = () => <div />;");
file = file.replace(/const DailyPaidHarvestCard = \(\) => <div \/>;/, "const DailyPaidHarvestCard: React.FC<any> = () => <div />;");
file = file.replace(/const YieldByVarietyWidget = \(\) => <div \/>;/, "const YieldByVarietyWidget: React.FC<any> = () => <div />;");
file = file.replace(/const WorkerLog = \(\) => <div \/>;/, "const WorkerLog: React.FC<any> = () => <div />;");

// Fix TS2339 Property 'appendDelta' does not exist on type '() => Element'
file = file.replace(/WorkerLog\.appendDelta/, "WorkerLog");

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
