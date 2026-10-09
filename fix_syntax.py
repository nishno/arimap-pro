with open('src/components/Harvesting/HarvestDashboard.tsx', 'r') as f:
    content = f.read()

# Fix the double }}
content = content.replace("                                        }}\n                                        }}", "                                        }}")

with open('src/components/Harvesting/HarvestDashboard.tsx', 'w') as f:
    f.write(content)
