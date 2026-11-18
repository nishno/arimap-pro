> Superseded for ordinary-account module access: see [current personal workspace policy](../USER_ACCESS.md). Historical grants no longer open company modules for non-management accounts.

# Worker account links, grants and personal earnings — 2026-11-18

## Why the empty page was misleading

The old MyWorkView only displayed `users/{uid}.workRecords`. Existing operational records live in `employees`, `harvestEntries`, `workAssignments.employeeHours` and payroll `transactions`. An empty profile array did not prove those records were absent from the cloud.

The replacement uses a trusted employer-issued employee link. Prefer active membership.employeeId; support an employer-controlled employee.userId and historical deterministic employee IDs. Never link by matching names or editable phone numbers. Ambiguous links stop personal aggregation. Missing links, read failures and empty ledger data are distinct states.

## Grants

Persisted membership.allowedModules remains the first authority, including an empty list. If it is missing, the UI can read the linked employer-owned HR visibleModules or assigned server role as a compatibility bridge. Historical Harvest/Planning/Admin labels map to harvesting/tasks/system. A role's explicit operational permissions can restore Harvest, Tasks and Work/Tasks access without granting platform administration.

Role definitions previously had a cloud write path but no subscription and no matching repository Firestore rule. Definitions now load by company, and new role IDs use `organizationId__roleId` with legacyId for old references. A job title such as Weigher remains a company Employee membership, not an unsupported or global privileged role. HR role changes no longer append global user roles.

Personal earnings remains available independently of optional company modules. A worker does not need the Accounting module to read their own payroll entries.

## Data displayed

- Picked kg: own non-voided harvestEntries.netWeightKg, not other workers' quantities.
- Hours: own employeeHours in accessible workAssignments. No assumed shift duration or guessed hours. If no individual logs are accessible, show unavailable, not invented hours.
- Accrued: ledger entries crediting acc-payroll for the linked employee.
- Paid: ledger entries debiting acc-payroll for the linked employee, matching the existing accounting convention.
- Balance: accrued minus paid; negative balances are retained rather than silently clamped.
- Currencies remain separate. When the record/company does not store currency, say unspecified; the language/currency switch never relabels or converts financial amounts.

This view does not manufacture accruals from harvested kg, combine profile workRecords with ledger postings, or assert bank settlement. Manually recorded event totals that were never saved as harvest entries are not automatically converted into personal picked rows by this patch.

## Privacy and rules

New personal queries are constrained by farm and linked employee ID. Payroll streams additionally constrain creditAccountId or debitAccountId to acc-payroll. Other employee payments and unrelated company transactions remain denied. These are read-only exceptions; workers cannot relink HR records or write financial data. LAN implements corresponding constrained read checks.

The existing broader HR/operational module permissions are not a complete field-level privacy migration. A minimal worker directory and authoritative per-worker statements remain follow-up work.

## Employer workflow

1. Update and rebuild local code; restart the local server that also serves the Firebase interface on port 3101.
2. As company manager, open the employee editor, select **Linked company account**, choose the invited member and save the desired modules.
3. If using custom roles, save the company role permissions and ensure the correct Firebase rules have been deployed.
4. Refresh the worker page. Do not clear browser IndexedDB/localStorage merely to refresh code: it may contain unsynchronized work.

If a linked employee cannot be identified safely, the page asks for this employer action instead of guessing identity.

## Firebase target

`npm run firebase:target` prints only project/database identifiers used by a normal production build, considering .env configuration. It never prints keys. The repository fallback uses project `gen-lang-client-0798297761` and named database `ai-studio-42204e0d-ec5c-4889-b8f7-38d7bcdb9a9d`.

Do not assume deployment to `(default)` updates that named database. Rules must target the actual configured project AND database. No production deployment was performed here. Custom build modes need their corresponding environment checked separately.

## Verification

`test:worker` checks own identities, ledger arithmetic, voided/foreign rows, separate currencies, legacy role mapping and constrained LAN reads. `test:worker:browser` covers employer-linked Harvest/Tasks grants, real kg/hours/accrual/payment/balance, custom server roles, reload and no Accounting menu. `test:rules` includes private payroll query success and foreign/unrelated/self-link-write denial.
