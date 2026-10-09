import re

with open('src/components/HarvestEventModal.tsx', 'r') as f:
    content = f.read()

# We need to find the duplicate blocks and remove them.
# There is a block starting from around line 888:
# <div className="border-t pt-4">
#     <div className="flex justify-between items-center mb-2">
#         <h4 className="font-semibold text-gray-700">{t('harvest.assigned_vehicles')}</h4>

idx1 = content.find('<div className="border-t pt-4">\\n                                <div className="flex justify-between items-center mb-2">\\n                                    <h4 className="font-semibold text-gray-700">{t(\\'harvest.assigned_vehicles\\')}</h4>')
if idx1 == -1:
    idx1 = content.find('                                <div className="flex justify-between items-center mb-2">\\n                                    <h4 className="font-semibold text-gray-700">{t(\\'harvest.assigned_vehicles\\')}</h4>')

print("idx1:", idx1)
