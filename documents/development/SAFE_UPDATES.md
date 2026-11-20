# Safe Update Protocol

To ensure we don't crash or corrupt the application during updates, follow these steps:

## 1. Sandbox First
Always develop massive UI changes or complex logic in `/src/features/`.

## 2. Type-Safe Sanitization
Before writing to Firebase, use the `sanitizeObject` utility in `src/firebase.ts`. This prevents "Nested arrays" or "Missing field" errors that crash Firestore.

## 3. Quota Management
- Prefer `getDocFromServer` for one-time reads if real-time updates aren't critical.
- Ensure `onSnapshot` listeners are properly unsubscribed in `useEffect` cleanup.
- If "Quota Exceeded" occurs, verify if we have infinite loops in `useEffect` causing excessive reads.

## 4. Permission Validation
Always run `lint_applet` after editing `firestore.rules` to ensure no syntax errors block the whole database.

## 5. Incremental Merges
Don't replace the entire `App.tsx` at once. Move functional blocks into dedicated components in `/src/components/` and import them back into `App.tsx`.
