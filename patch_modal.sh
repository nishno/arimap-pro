sed -i '2847,2856c\
            {isCloseModalOpen && (\
                <CloseHarvestModal\
                    isOpen={isCloseModalOpen}\
                    onClose={() => setIsCloseModalOpen(false)}\
                    onConfirm={handleFinishEvent}\
                    totalYield={event.totalNetWeightKg}\
                    employees={employees}\
                    entries={eventEntries}\
                    packagingItems={inventoryItems?.filter(i => i.category === '"'Packaging'"' || i.category === '"'Pallets'"')}\
                />\
            )}\
            {showDailyHarvestModal && (\
                <DailyHarvestModal isOpen={showDailyHarvestModal} onClose={() => setShowDailyHarvestModal(false)} event={event} employees={employees} entries={eventEntries} onSetHarvestEvents={onSetHarvestEvents} harvestEvents={harvestEvents} onLogActivity={onLogActivity} inventoryItems={inventoryItems} onSetInventoryItems={onSetInventoryItems} onSetEmployees={onSetEmployees} roles={roles} crops={crops} cropVarieties={cropVarieties} employeeGroups={employeeGroups} onSetEmployeeGroups={onSetEmployeeGroups} allHarvestEntries={harvestEntries} onSetHarvestEntries={onSetHarvestEntries} machinery={machinery} />\
            )}' src/components/Harvesting/HarvestDashboard.tsx
