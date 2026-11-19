# AgriMap Pro — Daily SOP Checklists

**English edition · 19 November 2026 · application reference d71db72**

Use with the [illustrated user guide](README.md). These procedures describe human checks around current workflows. They do not certify unconnected hardware or a complete cross-device offline merge.

## SOP 01 — Account and company onboarding

**Responsible:** farm owner / authorized company administrator.

- [ ] Confirm cloud or local/LAN mode and the correct company.
- [ ] Create or approve one account per person; do not share management credentials.
- [ ] Create/check one HR employee record and its explicit account link.
- [ ] Confirm role, rate model, currency and relevant team membership.
- [ ] Worker signs in and sees personal Dashboard, AI, Communicator and My work & earnings.
- [ ] Management-only operations remain hidden from ordinary workers.
- [ ] Person reviews service-profile public visibility and contact details.

**Accepted when:** the correct person can sign in, sees the expected workspace and is linked to their own employee record. Verification/accreditation follows the authorized process; a profile label is not proof of KYC.

## SOP 02 — Open a harvest shift

**Responsible:** harvest manager and weigh operator.

- [ ] Confirm active company, event, date, sector and variety.
- [ ] Confirm assigned workers, rates, currency and packaging tare.
- [ ] Test scale stability and one scanner/manual entry with approved training data before real operations.
- [ ] Confirm server connection and where entries will be stored.
- [ ] Assign devices/operators to avoid recording the same physical crate twice.
- [ ] Confirm a newly accepted entry appears in the management view.
- [ ] Agree what to do if connection, scale or scanner fails.

**Accepted when:** the event and first accepted record are correct and visible. Do not use the separate staging terminal as production payroll input.

## SOP 03 — Weigh and record a crate

**Responsible:** weigh operator.

1. Select the correct worker and identify the crate/code.
2. Read stable gross weight; confirm tare and unit.
3. Check net = gross − tare and that the value is plausible.
4. Save once and wait for acceptance.
5. Confirm the record and updated total before the next crate.
6. If a duplicate is suspected, stop and compare the original instead of repeatedly saving.

**Accepted when:** one physical transaction has one accepted operational record, with correct person, event, quantity and timestamp.

## SOP 04 — Duplicate or suspicious record

**Responsible:** operator reports; manager reviews.

- [ ] Preserve the suspect record and its original code/reference.
- [ ] Compare worker, event, weight, capture time and server receipt time where available.
- [ ] Determine whether it is a retry, repeat scan, corrected weighing or genuinely new transaction.
- [ ] Record the decision and reason using authorized correction/review controls.
- [ ] Inspect resulting totals and payroll impact.
- [ ] Keep unresolved/suspicious records out of final approved totals until reconciled.

**Accepted when:** the decision is traceable and totals include the intended physical quantity once. A red flag is an instruction to review, not permission to pay twice. The staging terminal's review does not automatically repair operational harvest records.

## SOP 05 — Connection loss and operator handover

**Responsible:** operator and shift manager.

- [ ] Note event, device, operator, last confirmed record and disconnect time.
- [ ] Confirm whether the specific workflow supports offline entry. Rich LAN operations need the server; the terminal pilot has a separate staging queue.
- [ ] Do not clear browser storage, reinstall the PWA or restore a snapshot while records are unsynchronized.
- [ ] Reconnect to the original workspace and let supported queued submissions settle.
- [ ] Compare record-level history with other operators' entries; do not re-enter the whole shift.
- [ ] Record unresolved differences and transfer responsibility explicitly.

**Accepted when:** both operators agree the last confirmed record and every pending item has a known owner/status. Do not close the harvest while unresolved device data remains.

## SOP 06 — Close and finalize harvest

**Responsible:** harvest manager.

- [ ] Ask every operator about pending/offline work.
- [ ] Reconcile worker records, boxes, gross/tare/net, materials and duplicates.
- [ ] Confirm destination: storage, market or sale.
- [ ] Complete finalization once; verify event status and resulting produce/stock record.
- [ ] Compare physical delivered/stored quantity with application quantity.
- [ ] Record actual money received separately from listing/invoice value.
- [ ] Retain references and record unresolved issues for follow-up.

**Accepted when:** physical quantity and recorded destination agree, with traceable references and no unexplained duplicates.

## SOP 07 — Receive stock or materials

**Responsible:** storekeeper / authorized management.

- [ ] Confirm supplier, order, destination depot and delivery reference.
- [ ] Count/weigh actual delivery and inspect units/condition.
- [ ] Receive delivered quantities once, noting shortages.
- [ ] Confirm resulting item balances and movement history.
- [ ] Match invoice to receipt; record payment separately.

**Accepted when:** one delivery has one receipt and the correct depot balance. Never combine a duplicate manual intake with the same purchase-order receipt.

## SOP 08 — Work completion and payroll review

**Responsible:** supervisor and accounts reviewer.

- [ ] Review actual hours, harvested quantity and agreed rate/currency.
- [ ] Confirm employee/user link and source event/work reference.
- [ ] Check accrued, paid and outstanding amounts separately.
- [ ] Record a real payment only when made; include method/reference where available.
- [ ] Worker reviews their own detailed history; investigate specific disputed records.
- [ ] Use authorized traceable corrections rather than unexplained deletion/re-entry.

**Accepted when:** the worker's own view matches approved source work and actual recorded payments, without mixing currencies or counting payment as a second expense accrual.

## SOP 09 — Agronomy plan to execution

**Responsible:** qualified agronomist / authorized operator.

- [ ] Confirm crop, stage, sector, symptoms, date and actual conditions.
- [ ] Label the source: AI-generated, agronomist-created or combined.
- [ ] Review materials, quantities, units and suitability before saving.
- [ ] Archive the conclusion; add to Agronomy only when authorized.
- [ ] Schedule the work and verify required equipment/materials.
- [ ] Record actual execution and compare stock movements; saving a plan is not execution.
- [ ] Review the result and retain references for later learning.

**Accepted when:** approved plan, actual execution and consumed materials are distinguishable and traceable. AI output is not evidence of a confirmed diagnosis.

## SOP 10 — Weather, soil and sensor review

**Responsible:** device administrator / farm manager.

- [ ] Check device identity, sector, units and last observation timestamp.
- [ ] Distinguish measured observations from forecasts/demo values.
- [ ] Treat missing/stale readings as unavailable, not safe/zero.
- [ ] Test the configured alert and disconnect/recovery behavior.
- [ ] Document maintenance, calibration and connectivity failures.

**Accepted when:** a known physical measurement reaches the correct company/location with a trustworthy timestamp. A visible hardware dashboard alone does not satisfy this check.
