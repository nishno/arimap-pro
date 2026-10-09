sed -i '2531,2540c\
                    <HarvestStatsGrid\
                        event={{\
                            ...event,\
                            totalNetWeightKg: filteredTotals.totalWeight,\
                            totalGrossWeightKg: filteredTotals.totalGrossWeight,\
                            totalBoxes: filteredTotals.totalBoxes,\
                            finalNetYieldKg: undefined // Force using totalNetWeightKg for live monitoring\
                        }}\
                        durationHours={durationHours}\
                        entries={filteredEntries}\
                        inventoryItems={inventoryItems}\
                        machinery={machinery}\
                        employees={employees}\
                    />' src/components/Harvesting/HarvestDashboard.tsx
