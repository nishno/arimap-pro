# Design system

Modern uses warm neutral surfaces, dark readable text and forest green for primary actions. Color indicates state rather than module identity. Error messages use muted terracotta and include text. No neon, decorative glow or all-caps navigation.

System fonts avoid external font requests. Main text is 15px, form controls 16px; headings use restrained weights. Cards use 12–16px radii and subtle borders. Actions and form controls are normally 48px high. Keyboard focus remains visible; dialogs trap focus and restore it after closing. Reduced-motion preferences are respected.

Desktop uses a sidebar and generous content grid. Tablets use a navigation drawer; narrow screens also have bottom navigation. Dense records reflow into rows, rather than forcing horizontal scrolling. New selectors, buttons and cards belong in `src/modern/modern.css`, scoped under `.sonik-modern`. Classic CSS must not be imported here.

Next: complete Georgian translations, test longer names and additional languages, accessibility review on real tablets and outdoor brightness testing.
