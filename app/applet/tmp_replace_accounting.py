filepath = "src/components/AccountingView.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replacements
content = content.replace(
    "const left = Math.max(0, balance - salaryPayoutAmount);",
    "const left = Math.max(0, balance - (Number(salaryPayoutAmount) || 0));"
)
content = content.replace(
    "sumSelectedOutstanding - salaryPayoutAmount",
    "sumSelectedOutstanding - (Number(salaryPayoutAmount) || 0)"
)
content = content.replace(
    "totalAllOutstandingBasis - salaryPayoutAmount",
    "totalAllOutstandingBasis - (Number(salaryPayoutAmount) || 0)"
)
content = content.replace(
    "salaryPayoutAmount > sumSelectedOutstanding",
    "(Number(salaryPayoutAmount) || 0) > sumSelectedOutstanding"
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Replacement complete")
