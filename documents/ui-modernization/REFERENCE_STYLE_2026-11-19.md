# Reference analysis and UI adaptation — 2026-11-19

Reference repository: nishno/agrimap_new, commit `19d4bbd82e12989e02c88a010bd6eda5463f98d5`. Implementation target: nishno/arimap-pro, demo-preview. The reference repository was inspected without modification.

## What the reference does well

| Screen | Useful patterns adopted |
| --- | --- |
| Announcements & Plantations | Unified company/hiring/service feed; segmented All/Hiring/Service Offers/Plantations controls; search and region/work/contract/crop filters; counts; compact cards with metadata and contact/details/map actions; matching filtered map checkpoints. |
| My work & earnings | Clear page heading and next action; four compact summary cards; currency-separated balance cards; Activities/Harvest/Payroll history tabs; an expandable CV/service section. |
| Clinical prescriptions | Restrained slate typography, white bordered cards, emerald primary actions, a diagnostics column beside a prescription editor, grouped form fields and clear archive/save actions. |

The shared visual vocabulary uses subtle borders, light canvas backgrounds, consistent corners and spacing, medium-weight readable labels and generous touch targets. Layouts stack on narrow screens rather than moving content off-screen.

## How it was adapted

- The current jobAnnouncements collection, opt-in partnerProfiles directory and registered company metadata remain the data sources. The reference stores its structured announcements in forumPosts; adopting that storage model would require different permissions and migration. No data migration or database-rule change is needed for this UI adaptation.
- Service Offer cards come from users' published service profiles. The ordinary user's Offer a service action opens their existing profile workflow. Only authorized company management receives the job-posting action. This does not add an independent service-ad collection or permit workers to publish employer vacancies.
- One pure discovery filter function produces the rows used by both feed and map. Crop/variety searches include published company metadata; work and contract filters use the available recorded fields. Options are derived from real records so they support regions worldwide.
- Map pins require actual published coordinates or a valid plantation boundary. No approximate/random coordinates are invented for profiles with only a region. Such entries remain discoverable in the list and explicitly report that an exact location is unavailable.
- The management vacancy composer includes optional work type, worker count, compensation/terms and crop/variety fields. Values remain public vacancy metadata; they never create payroll entries or change company stock.
- On phones, advanced filters collapse so the result feed retains usable space.
- Existing partner messages, company detail popups, manager vacancy composer, membership review and role guards remain available. Announcements & Plantations is now the primary Communicator tab. Find partner & work opens that tab.
- Earnings calculations, trusted employee links, payroll queries, transaction-to-work references and currency separation are unchanged. Missing/unreadable records are not presented as confirmed zero balances.
- Clinical storage, author/source category, timestamps, archive edit/reuse/delete behavior and management-only reviewed-plan dispatch are unchanged. The redesign applies to both embedded and popup diagnostic workspaces.

## Files

- src/worker/discovery.ts: public listing adapters, validated positions and shared filters.
- src/worker/DiscoveryPanel.tsx: unified feed, filters, cards and matching checkpoints.
- src/components/reference-ui.css: scoped discovery and earnings visual rules.
- src/components/MyWorkView.tsx: summary cards, currency balances and history tabs.
- src/components/clinical-workspace.css: prescription/diagnostic presentation.
- src/components/CommunicationHubPanel.tsx: primary discovery entry and existing workflow integration.

## Validation and deployment

Tests cover filter/list/map agreement, actual-coordinate handling, private-profile exclusion, role-appropriate publishing controls, earnings/ledger tabs, desktop/mobile overflow and the existing clinical archive/plan workflows. Visual checks use fixture data. No production data, provider credentials, Firebase rules or hosting were changed or deployed. Existing Gemini server configuration and the previous release's Firestore rules still apply.

Executed checks: TypeScript and production/PWA build; 11 discovery/worker-summary/worker-record/role unit cases; the new desktop/mobile reference-style browser flow; existing worker earnings/CV browser coverage; and the clinical archive/plan-dispatch/community browser flow. Desktop/mobile screenshots were inspected. Test map tiles were blocked externally, so the screenshots validate the layout and checkpoint behavior rather than a live basemap provider.
