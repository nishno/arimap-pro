# Georgian and English interface — 2026-10-19

The main keyed dictionary is `src/translations.ts`, not `utils/translation.ts`. `src/contexts/LanguageContext.tsx` owns the selected language, pricing region and currency. All entry routes now share that provider.

## Files to edit

- `src/translations.ts`: existing `t("key")` strings in English and Georgian.
- `src/i18n/keys.json`: supplemental keys previously missing from the dictionary.
- `src/i18n/overrides.ts`: reviewed Georgian wording and shared terminology; these entries take precedence over generated translations.
- `src/i18n/ka.json`, `en.json`: bundled catalogues for legacy literal labels and bilingual fragments. Bulk wording is machine-assisted and should receive native-speaker editorial review, especially specialist agronomic and hardware terminology.
- `src/i18n/runtime.ts`: lookup, placeholder substitution and server-error display translation.
- `scripts/ui-text.mjs`: source-aware Vite transformation of visible text, display attributes, option labels and notifications. Programmatic error codes/messages retain their original values; local API errors are localized at the display boundary. `UiText.tsx` subscribes each translated label to the shared language context. Inputs are not remounted on language change.

User-entered names, farm records, identifiers, stored select values, URLs and code blocks retain their original content. Brand names and protocol names can remain Latin text. Device responses, AI-generated prose and remote market content require their own language support; an offline interface dictionary cannot rewrite those providers' output.

## Maintenance

Run `npm run i18n:audit` to produce ignored phrase/reference reports in `tmp/i18n/`. The developer-only `python scripts/translate-catalog.py` and `--english` can populate missing static phrases using an external translation service. Do not pass live records or credentials to that script. No translation-service requests occur when running the application; the catalogues ship with the build.

Run `npm run test:i18n`, `npm run test:registration`, `npm run test:modern`, `npm run lint` and `npm run build` after changes. The browser regression checks language switching with an open form, preservation of company names, canonical local registration and reload. It is not a manual review of every historical dialog or third-party message.
