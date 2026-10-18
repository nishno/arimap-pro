# Readiness and follow-up roadmap — 2026-10-18

The initial partial-screen migration was replaced: `/modern` and `/classic` now share the original full application and authenticated local documents. The Modern styling layer can be refined module by module while retaining working workflows.

| Area | Implemented | Still required |
| --- | --- | --- |
| Local identity | Trusted owner initialization, shared session, original Founder context, worker restrictions | Granular local roles for rich module editing |
| Full modules | Original screens and local document adapter, atomic batches and persistence | Comprehensive acceptance testing for every historical workflow |
| UI switch | Same account/data, pending map/write flush | Further tablet/outdoor usability review |
| Dashboard | Real local context; fabricated examples removed | Connect actual devices and validated analysis |
| Backup | Explicit upload/download, private rules, checksum and transactional document restore | Deploy rules to confirmed project/database; real-account staging test |
| Existing data | Existing SQLite accounts and legacy records retained | Reviewed import/mapping of existing cloud plantations |
| LAN | Existing trusted HTTPS configuration | Configure certificates and network on the user's plantation |
| External services | Existing integration screens retained | Provider credentials/connectivity, RTSP media gateway and physical sensors |
| Offline devices | Failures visible, no false server confirmation | Durable device queue and conflict-aware multi-device editing |
| Modern appearance | Scoped calm palette on original workflows | Full typography/spacing audit, localization and component refinements |

Do not describe an unconfigured external service, undeployed rules or untested historical workflow as production-ready. Record actual acceptance evidence in TESTING.md.
