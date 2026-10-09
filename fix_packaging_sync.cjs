const fs = require('fs');
let file = fs.readFileSync('src/components/Harvesting/HarvestDashboard.tsx', 'utf8');

// Replace finalBoxQty and finalPunetQty lines
const targetLines = `                                                    const finalBoxQty = parseFloat(pkgBoxQty) || filteredTotals.totalBoxes || 0;
                                                    const finalPunetQty = parseFloat(pkgPunetQty) || Math.round(finalBoxQty * parseFloat(pkgPunetsPerBox || "12"));`;

const newLines = `                                                    const displayBoxQty = event.totalBoxes !== undefined ? event.totalBoxes : (filteredTotals.totalBoxes || 0);
                                                    const finalBoxQty = pkgBoxQty !== "" ? parseFloat(pkgBoxQty) : displayBoxQty;
                                                    const displayPunetQty = event.physicalPunets !== undefined ? event.physicalPunets : Math.round(finalBoxQty * parseFloat(pkgPunetsPerBox || "12"));
                                                    const finalPunetQty = pkgPunetQty !== "" ? parseFloat(pkgPunetQty) : displayPunetQty;`;

file = file.replace(targetLines, newLines);

const updatedEventLine = `const updatedEvent = { ...event, materialsUsed: newMaterials };`;
const newUpdatedEventLine = `const updatedEvent = { ...event, materialsUsed: newMaterials, totalBoxes: finalBoxQty, physicalPunets: finalPunetQty };`;

file = file.replace(updatedEventLine, newUpdatedEventLine);

fs.writeFileSync('src/components/Harvesting/HarvestDashboard.tsx', file);
