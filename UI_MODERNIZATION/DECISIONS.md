# Decisions

- 2026-10-15: Keep Classic version constants and components; introduce a separate Modern version constant and lazy route. Classic changes are limited to the entry link and shared route selection.
- Reuse existing local session cookies and server authorization. Owners create fields/workers; workers record harvests. UI visibility does not replace server checks.
- Guest data is static and labelled. Guest actions lead to account entry; they never write to live farms.
- No public local-owner registration. The trusted console initializes an owner; owners invite workers.
- Cloud registration uses Firebase Auth and creates a minimal free profile only if none exists. It grants no paid subscription, admin claim or owner status. Registration failures after account creation direct the user to sign in again, avoiding accidental duplicate accounts.
- Cloud workspaces currently list only organizations owned by the signed-in user, not all memberships. Cloud operational modules remain in Classic. The Modern screen does not invent cloud totals.
- Cloud and local accounts are distinct existing identity providers. Switching UI does not link them, enable backup sync or merge records.
- USD/GEL draft prices are separate tariffs, not converted exchange rates. Georgia plus Georgian language defaults to GEL; explicit currency selection remains available. No checkout is enabled.
- A loopback-only development emulator flag supports tests. It is disabled in production builds.
