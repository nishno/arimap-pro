const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

const target = `    const [isAddingOpexItem, setIsAddingOpexItem] = useState(false);`;
const replacement = `    const [isAddingOpexItem, setIsAddingOpexItem] = useState(false);
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    const [newVehicleName, setNewVehicleName] = useState("");
    const [newVehicleCost, setNewVehicleCost] = useState("");
    const [isAddingMaterial, setIsAddingMaterial] = useState(false);
    const [newMaterialId, setNewMaterialId] = useState("");
    const [newMaterialQty, setNewMaterialQty] = useState("");`;

file = file.replace(target, replacement);

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
