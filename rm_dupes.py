import re

with open('src/components/HarvestEventModal.tsx', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    # Find the SECOND assigned_vehicles
    if '<div className="border-t pt-4">' in line and i > 600:
        if '<div className="flex justify-between items-center mb-2">' in lines[i+1] and "t('harvest.assigned_vehicles')" in lines[i+2]:
            start_idx = i
            break

for i in range(start_idx, len(lines)):
    # Find the START of the materials_used section
    if '<div className="border-t pt-4">' in line and '<div className="flex justify-between items-center mb-2">' in lines[i+1] and "t('harvest.materials_used')" in lines[i+2]:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    lines = lines[:start_idx] + lines[end_idx:]
    with open('src/components/HarvestEventModal.tsx', 'w') as f:
        f.writelines(lines)
    print(f"Removed duplicates from {start_idx} to {end_idx}")
else:
    print(f"Not found: start_idx={start_idx}, end_idx={end_idx}")

