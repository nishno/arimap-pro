import re

with open('src/components/Harvesting/HarvestDashboard.tsx', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '{/* Packaging & Punet Quantities (Sync to Stock) */}' in line:
        start_idx = i
    if 'setPkgPunetQty("");' in line and start_idx != -1 and end_idx == -1:
        end_idx = i + 10 # approximate to include the closing tags

