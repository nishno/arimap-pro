# Guest experience, proposed subscriptions and platform administration

## Guest experience

`/demo` remains separate from production Firebase and farm storage. It now includes dashboard/field examples, harvest simulation, weather/camera previews, a map planner, sample marketplace listings, an agronomy-analysis preview, message drafting and proposed plans.

The planner uses public OpenStreetMap tiles with attribution. Enter latitude/longitude or explicitly request browser geolocation. Click to sketch a boundary; undo/clear are available. No guessed plantation coordinates are saved. The initial map is only a Guria regional view. Sketches stay in isolated browser session storage until the session ends or the demo is reset. They are not real farm records. Saving shows a registration gate. Carrying a guest draft through registration into a real workspace requires a reviewed import flow; it is not implemented.

Marketplace listings and communicator messages are sample data. Sending/publishing/contacting requires registration; no real recipient receives guest drafts. The agronomy preview uses prepared educational examples, not fabricated live AI output. Real guest AI needs an anonymous-session backend with abuse controls, provider billing limits and a quota (consider three introductory queries), plus a clear path to registration. Public live market/community data needs a separate publication model that excludes private farm and contact data. These services are not activated by this change.

## Proposed commercial model

Charge per farm workspace, with workers included, rather than charging every tablet or worker separately. The existing header language/currency controls are retained, with a pricing-region selector. Georgia plus Georgian defaults to GEL; other defaults use USD. Manual currency changes remain available. Proposed Georgian tariffs are Starter GEL 49/month and Pro GEL 129/month, independently specified rather than relabeling USD amounts or asserting a live exchange rate. Confirm both tariff sets, taxes and recurring-payment provider before launch. The isolated guest header offers its own switches without changing production preferences. New guest copy is not fully translated yet.

| Plan | Proposed monthly price | Proposed scope |
| --- | --- | --- |
| Guest | Free | Explore samples, session sketches, read public content when its backend is available |
| Trial | 14 days, no charge | Evaluate one farm; once per farm, authorized approval required |
| Starter | USD 19 / GEL 49 | One farm, 3 users, mapping, planning, harvests, basic reports |
| Pro | USD 49 / GEL 129 | One farm, 10 users, advanced reports, connected weather/cameras and metered AI |
| Enterprise | Agreement | Multiple farms, negotiated limits, integrations/support and local deployment terms |

These prices/allowances are proposals in `src/billing/catalog.ts`, not an active checkout or enforced quota catalog. Do not sell unavailable hardware integrations or promise unlimited AI. Consider annual pricing at ten months of the confirmed monthly rate once billing is ready. Do not charge marketplace browsing or community access separately just to force a farm-management subscription.

Payment processing is not connected. Evaluate a payment provider that supports your Georgian business entity, global customers, taxes, recurring charges and refunds; do not assume Stripe availability. Paid entitlement must come from verified, idempotent payment webhooks or explicitly audited manual grants, never browser flags or a selected price.

Local licensing is not enforced yet. Before launch, define signed offline licenses and a grace period, retain access to owned data/export when a plan expires, and avoid stopping critical farm operations during temporary internet loss. Local-only users are not automatically visible to the platform owner.

## Subscription flow implemented

The subscription modal shows the proposed catalog and writes an owner/admin plan request. It never grants a trial or marks payment as received. Pending requests use stable IDs. Cloud organization creation starts unpaid with empty trial dates; a client cannot update protected billing fields under the revised rules.

The root subscription tab includes requests and a cloud workspace summary. A trusted administrator can approve a manual grant or reject a request with a reason. A Firestore transaction rechecks the request, grants an expiry, records the reviewer and creates an immutable billing audit entry. Manual grants explicitly keep `isPaid:false`; they are not payment receipts. The UI checks existing trial markers to prevent repeating a farm trial through this flow. Enterprise agreement requests require separate contract review.

Full server-side feature limits, seat quotas, expiry enforcement on every paid write, payment webhooks, cancellations, refunds, dunning and quota dashboards are still required before accepting subscriptions. Existing data/permission code needs staged migration. The revised rule file must be reviewed with existing organization records and all application workflows before deployment.

## Super-admin setup

The existing root panel already contains users, organizations, plantations, membership/role assignments, subscriptions and logs. Access now requires a real Firebase ID token with the trusted `admin:true` claim, matching the signed-in profile. An editable profile role or browser storage cannot grant platform access.

Two platform levels are supported: `platformOwner:true` (God mode) can grant/revoke super-admin access through the trusted backend; `admin:true` can manage cloud users/farms and review billing, but cannot promote another platform administrator. A hardcoded root username/password is not an authentication mechanism. Reuse verified existing Firebase accounts; confirm exact UID/email before provisioning. Never commit or reuse a password disclosed in chat.

A console-only helper is available:

```sh
npm run platform:grant-admin -- --project YOUR_FIREBASE_PROJECT_ID --uid YOUR_FIREBASE_USER_UID --role admin --confirm
```

Run it only on a trusted administrator's machine with authorized Firebase Admin Application Default Credentials. Keep any service-account file outside the repository; do not send keys or passwords through chat. The helper verifies an existing Auth user/application profile, preserves other custom claims, grants the admin claim, updates the profile role and records a platform audit entry. It has not been run against production. Sign out and sign in afterward to refresh the token. Use `--role owner` instead for the confirmed root account. The exact target project/UID and authorized server credentials are prerequisites. The existing injected credential file is present but a read-only Firebase Admin check failed with app/invalid-credential; no production claim has been granted.

The owner-only "Super-admin access" tab calls `/api/platform/admins`, provided as a Vercel Node serverless function. It verifies the ID token with revocation checking and rechecks the actor’s current Auth claims. It grants/revokes super-admin authority on existing registered users and also offers explicit super-admin login deletion, requiring the exact UID confirmation and a second browser confirmation. Deletion first blocks Firestore access, disables/revokes the Auth account, then deletes that login while retaining farm data, a tombstoned profile and audit history. Owner accounts cannot be changed here. Cloud Auth operations are unverified against production. Revocation updates a server-only `platformAccess` record so old admin ID tokens immediately lose Firestore admin authority. Audit records track started/completed/needs-reconciliation outcomes because Firebase Auth and Firestore cannot commit one cross-service transaction.

Configure `FIREBASE_PROJECT_ID` and authorized server-side credentials on the platform backend. On Vercel, `FIREBASE_ADMIN_SERVICE_ACCOUNT` can hold the service-account JSON securely as an environment secret; never use a `VITE_` name. Trusted server environments may use Application Default Credentials instead. Do not install platform administrator keys on ordinary farm local servers. The static local/dev server does not provide this global endpoint; errors are visible and there is no mock success. No Vercel deployment or live backend validation has occurred.

Changing ordinary user-profile status is not equivalent to disabling a Firebase Authentication account or revoking every token. The new owner-only backend covers super-admin lifecycle; a separate audited backend for ordinary-user disable/revoke still needs implementation. Platform roles, farm membership roles and billing entitlements must remain separate. Never turn a farm administrator into a platform super-admin through membership assignment.

The platform can enumerate cloud-registered records with its trusted claim. Offline local servers are private and cannot be enumerated remotely. Registration of a local installation and optional owner-authorized cloud backup/linking must be implemented separately before those farms appear here.

## Verification and boundaries

The expanded guest browser test checks marketplace/message gates, example analysis, coordinate lookup, boundary drawing, plan comparison, mobile layout and unchanged production storage, with no Firebase/AI requests. Type checking and production build are required. The Firestore suite includes billing escalation, owner-only requests, request ownership, review, audit immutability, protected owner profiles, deleted/revoked authority and prior privilege/tenant tests. Platform policy/API tests pass, and an end-to-end run with real Firebase Auth and Firestore emulators verifies owner tokens, actual Auth grant/revoke/deletion, retained farm records and completed audits. These are demo-project emulator results, not live Firebase/Vercel validation. Emulator tests use a demo project, not production.

No checkout, payment, real AI query, production admin grant, cloud backup or live Firebase rule deployment is performed by this work. Actual OpenStreetMap/geolocation and user registration require browser/network/provider testing on user devices. Existing app rules are not a complete security certification.
