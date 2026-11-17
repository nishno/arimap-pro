# Authentication and tenant boundaries

Pilot: same-origin LAN application, existing HttpOnly session cookie, owner-only server gate. Worker and anonymous API access are denied. No client-supplied farm/user label grants authority. References and bootstrap data are restricted to the server farm. No cloud rules were changed or deployed.

Planned external handshake: allowlisted app URL, authenticated launch request, short-lived one-time code bound to app, actor, farm and purpose; exact-origin/source checks and nonce validation; server-side code redemption. Never use `postMessage('*')`, Firebase tokens in query strings, or client filters as authorization.

Each external Firebase app requires its own valid Firebase session if directly reading Firestore. Local authorization must work without Firebase. Firebase Admin SDK bypasses rules, so APIs must independently enforce tenant and role checks.

Before cloud rollout: active membership checks, immutable organization ID, collection/action/field permissions, separate platform claims, restricted pay/finance access, and cross-tenant emulator tests. Existing broad legacy Firestore/LAN collection permissions still need an explicit migration. This pilot does not claim to fix them globally.

Offline device unlock and temporary delegated capabilities require a separate threat model and expiry policy. A disconnected device cannot immediately learn that a remote admin revoked access.
