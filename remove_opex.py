import re

with open('src/components/HarvestEventModal.tsx', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '{/* Packaging & Punet OPEX Configuration */}' in line:
        start_idx = i
    if '<div className="border-t pt-4">' in line and i > start_idx and end_idx == -1:
        if '<div className="flex justify-between items-center mb-2">' in lines[i+1] and "h4" in lines[i+2]:
            end_idx = i

if start_idx != -1 and end_idx != -1:
    lines = lines[:start_idx] + lines[end_idx:]
    with open('src/components/HarvestEventModal.tsx', 'w') as f:
        f.writelines(lines)
    print("Removed OPEX block")
else:
    print("Not found", start_idx, end_idx)
