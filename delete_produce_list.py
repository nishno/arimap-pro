import sys
with open('src/components/InventoryView.tsx', 'r') as f:
    content = f.read()

start_idx = content.find('const ProduceList: React.FC<StockViewProps & { selectedSectorId?: string }> = (props) => {')
end_idx = content.find('const ItemsList:')

if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
    new_content = content[:start_idx] + content[end_idx:]
    with open('src/components/InventoryView.tsx', 'w') as f:
        f.write(new_content)
    print('Deleted ProduceList successfully')
else:
    print('Failed to find boundaries')
    print('start_idx:', start_idx, 'end_idx:', end_idx)
