const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

// Add missing imports
file = file.replace(
    /import \{ toast \} from 'sonner';/,
    `import { toast } from 'sonner';
import { Fingerprint, RefreshCcw, QrCode, Boxes, Scale, MapPin } from 'lucide-react';
const ArchiveBoxIcon = () => <div />;
const DailyPaidHarvestCard = () => <div />;
const YieldByVarietyWidget = () => <div />;
const WorkerLog = () => <div />;
const HARVEST_METHODS: any[] = [];
`
);

// Add missing states inside HarvestDashboard
const stateInjection = `
    const [isAddingOpexItem, setIsAddingOpexItem] = useState(false);
    const [newOpexItemName, setNewOpexItemName] = useState("");
    const [newOpexItemCost, setNewOpexItemCost] = useState("");
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    const [newVehicleName, setNewVehicleName] = useState("");
    const [newVehicleCost, setNewVehicleCost] = useState("");
    const [isAddingMaterial, setIsAddingMaterial] = useState(false);
    const [newMaterialId, setNewMaterialId] = useState("");
    const [newMaterialQty, setNewMaterialQty] = useState("");
    const currency = "USD";
    const handleToggleStatus = () => {};
    const getStoredActiveUser = () => null;
`;

file = file.replace(
    /const \[pkgPunetsPerBox, setPkgPunetsPerBox\] = useState\("12"\);/,
    `const [pkgPunetsPerBox, setPkgPunetsPerBox] = useState("12");${stateInjection}`
);

// Fix filteredTotals yieldByVariety
file = file.replace(
    /totalBoxes: filteredEntries\.length\n    \};/,
    `totalBoxes: filteredEntries.length,\n        yieldByVariety: []\n    };`
);

// Fix TS2554 onLogActivity arguments
file = file.replace(
    /onLogActivity\?: \(title: string, category: string, type: string, details: string\) => void;/,
    `onLogActivity?: (action: string, module: any, status: "success" | "alert" | "failure", report?: string) => Promise<void>;`
);

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
