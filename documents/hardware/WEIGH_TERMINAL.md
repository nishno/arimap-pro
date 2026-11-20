# Weigh terminal workflow

Current pilot: authenticated LAN owner selects an existing event and employee, enters/scans a box code into a text field, enters gross/tare manually and saves locally. The field supports ordinary keyboard input and keyboard-wedge scanners; specific hardware has not been tested. Pressing scanner Enter can submit the form if required fields are valid; scanner-specific behavior/debounce is not yet implemented.

A repeated code within the same event preserves the new capture in red for review instead of silently counting or dropping it. The next box can be entered. Each saved attempt is staging-only. Synchronization can identify additional cross-device suspects and marks both linked records. These are alerts, not proof of duplicate physical receipt.

History shows capture/received time, actor, device, status and review decisions. Current filters: all, suspicious and pending upload. Advanced date/user/device filters, search and correction commands remain planned. Reviewer decisions require a reason and current record revision. Reviewed/rejected status never creates a business posting in this version.

Production requirements: distinguish worker badge, reusable crate and specific fill/receipt IDs; detect repeated camera frames; weigh stability, unit, tare and calibration rules; cancel/confirm/correct/new-fill actions; candidate decision while scanning the next code; approved/review totals; append-only corrections with revisions.

The original WeighStationModal remains the operational path. Do not enter real harvest in both paths expecting automatic reconciliation.
