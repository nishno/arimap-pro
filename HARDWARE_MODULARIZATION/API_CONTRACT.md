# Weigh terminal pilot API — version 1

All endpoints are under `/api/local/terminal/`. Existing Host, same-origin write checks, HttpOnly session authentication, and server authorization apply. Pilot access is owner-only.

| Endpoint | Contract |
| --- | --- |
| GET `bootstrap` | Returns farm/user identity, farm-scoped event IDs/names/statuses and active employee IDs/names. No pay rates, credentials or finance records. |
| POST `operations` | Accepts one immutable staging operation; returns current server record and `replayed`. |
| GET `changes?cursor=0` | Up to 200 changes; returns current record versions, monotonic cursor and `hasMore`. Repeat to catch up. |
| POST `review` | Requires expected authenticated actor ID, operation ID, expected revision, confirm/reject decision and a reason of at least 5 characters. Changes staging only. |

Operation fields: `schemaVersion:1`, `operationId`, `organizationId`, `actorId`, `deviceId`, `eventId`, `workerId`, `boxQrId`, `grossKg`, `tareKg`, `capturedAt`. IDs are bounded. `actorId` must equal the authenticated user; farm identity must equal the server farm. Server derives net kg and authoritative received time.

The authenticated actor and canonical payload digest bind operation ID reuse. Same operation retry returns the existing record. Same ID with different data fails 409. Unknown event fails 409 without deleting local work. Inactive/missing employee and non-active event are staged for review. Weight/tare are manual and unverified in this pilot.

Same event + same exact trimmed box code is flagged as suspicious, not proven duplicate. Both records are linked and moved to review. Legitimate box reuse needs an explicit receiving-cycle model before production projection. Existing legacy harvest entries are not yet checked.

Staging writes and change journal entries run in one SQLite transaction. Review uses expected revision; stale review fails 409. No harvest, stock, payroll or financial write occurs.

Future contract: server-calculated tare/tariff snapshots, receipt-cycle ID, event-scoped operators, field validation and one-time business projections. Do not grant external apps generic finance or inventory write access.
