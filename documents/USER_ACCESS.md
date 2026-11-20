> Updated 2026-11-19: familiar Dashboard/AI Analyst/Communicator screens are retained with filtered tools. New users without an active company membership can draw a memory-only plantation draft; workers with a company membership do not gain operational Planner access. Personal CV/services/reviews are also available under My work & earnings. See [dated update history](UPDATE_HISTORY.md).

# Personal and company workspaces

## Current policy — 2026-11-18

This policy supersedes earlier worker module grants in MODULE_ACCESS.md and WORKER_RECORDS.md.

Signed-in non-management accounts see Dashboard, My work & earnings, AI tools and Communicator. Their profile provides CV, offered services, availability, discovery consent and reviews. Communicator exposes Find Partner and direct partner messages only. Market, company Harvest, Planner, Tasks & Works, Accounting, Stock and administration are hidden and direct routes return to the personal dashboard. Historical allowedModules, HR checkboxes and custom-role operational permissions cannot elevate these accounts.

Company operations require an active membership for the selected company as Admin, Manager (including the existing Field Manager role), Founder or Co-Founder. Verified platform administrators retain platform access. A profile role label or a URL never grants platform authority. Managers' explicit module lists still constrain their navigation. LAN currently provisions owner and worker accounts; its owner is the management account. LAN manager provisioning is not implemented by this change.

## Assignment notices and CV

When a manager opens the updated application/company, useActivityPublisher watches server-confirmed workAssignments and harvestEvents and publishes deterministic, per-employee workerActivities documents. Existing assignments are backfilled then. Each projection contains only that employee's assignment, hours, recorded quantity and agreed rate. Workers cannot edit these records or read other employees' projections. Removed assignments are marked withdrawn, preserving history.

Dashboard notices are in-app notices, not background push notifications. Offline cached notices may be older than the server. Publication requires a connected manager session; there is no deployed background Cloud Function. Stable content hashes avoid repeated publication. This projection never changes payroll, source assignments or inventory.

Completed assignments generate a work-experience preview. The user can add that preview and manual experience to their editable CV. Discovery is opt-in. A separate partnerProfiles directory publishes selected CV/service fields, excluding payroll and rates; switching off discovery deletes that directory document. Public CV experience is user-editable and is not verified financial evidence.

## Own work and money

The employer must link the account using membership.employeeId or employee.userId. Ambiguous or conflicting links stop aggregation. Personal harvest and payroll queries require the linked employee and company. Payroll reads additionally require the payroll account. Workers cannot modify these records.

My work & earnings shows recorded quantities, hours, accruals, payments and balances separately by ledger currency. Per-work payment allocation is shown only when a ledger referenceId matches the source work/event ID. Payer, payment method and dates are shown when recorded; missing details are labelled rather than guessed. Historical records without those fields need employer correction. Display currency switching does not convert ledger values.

## Rollout

1. Pull demo-preview, install dependencies, build and restart the local server. Do not reinitialize an existing farm or clear unsynced browser storage.
2. For Firebase mode, deploy firestore.rules to the actual project AND database used by the application. Git pull does not deploy cloud rules. npm run firebase:target identifies the configured target. No production rules were deployed during this change.
3. Open the company as its manager once to publish existing assignments. Verify employee links, then sign in as the worker.

## Verification

TypeScript, production build, role-policy tests, LAN document/API tests, projection tests, Firestore emulator authorization tests, and isolated browser flows cover this change. Tests do not use live customer data. Legacy public listing/project rules outside company operations remain a separate audit scope.
