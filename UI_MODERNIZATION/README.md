# sonik g2.0.1.4 — parallel Modern UI

The first Modern preview lives at `/modern`. Click **sonik g2.0.1.4 · Try new UI** beneath the Classic/local logo. Click the version beneath the Modern logo to return. `/modern/login` and `/modern/register` open the account screens directly.

Classic remains the complete interface. Modern uses a separate lazy entry and scoped stylesheet. It shares the existing local API and Firebase identities; it does not copy databases or migrate schemas. Switching is explicit, without changing Classic's theme preferences. Opening a Classic module updates the existing navigation preference only.

## Available now

- Isolated, clearly labelled guest sample workspace.
- Local server sign-in, real overview, field creation, harvest recording, owner-managed workers and simple harvest totals.
- Cloud registration/sign-in with the existing Firebase account system. New profiles are free and unprivileged; existing profiles are retained. Cloud module editing remains in Classic.
- Proposed per-farm plans, region/language/currency selectors, responsive tablet/mobile navigation.
- Explicit Classic bridges for unmigrated modules. English is the primary preview language; Georgian navigation is partial.

See [ROADMAP.md](ROADMAP.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [DECISIONS.md](DECISIONS.md), [CHANGELOG.md](CHANGELOG.md) and [TESTING.md](TESTING.md). Add an entry here whenever the Modern UI changes.

## Run

Use Node 24, then `npm ci` and `npm run build`. For an existing local installation, run `npm run local:start` and visit `http://localhost:3100/modern`. Run `npm run local:init` only for a new farm server. Preserve `.local-data` and your backups when updating application files. For UI development, `npm run dev` serves the preview; real local workflows need the farm server serving the built app.
