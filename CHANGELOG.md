# Changelog

All notable changes to EnterNewLine are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Test suite: Vitest + jsdom with 118 tests across 13 files. Covers shared
  modules (matching, migration, storage, events, custom sites, site status),
  the stats batcher (fake timers), key-routing logic, per-site rules
  (newline insertion + per-input-type quirks), import/export, the changelog
  parser, and full DOM tests for popup and options interactions. Includes a
  shared `webextension-polyfill` fake under `tests/fakeBrowser.ts` and a
  `tests/setup.ts` that polyfills the slice of jsdom APIs (`isContentEditable`,
  `URL.createObjectURL`, `Blob.prototype.text`) we depend on.
- `.docs/smoke-checklist.md` — manual cross-browser load-unpacked verification
  steps for Chrome and Firefox, run before tagging a release.
- `npm test` (`vitest run`) and `npm run test:watch` scripts.
- Popup UI (340px): masthead with wordmark and state dot, current-site row
  with pill toggle, two-column stats (this site / global), and an
  "All settings →" ghost link. Live-updates as the background flushes stats.
- Options page (720px): default-sites list with toggles, custom-sites list with
  per-site remove (destructive confirm), add-site form with hostname validation
  and batched permission request, import/export JSON round-trip with a single
  batched permission prompt on import, inline changelog (3 most recent
  releases) with a "Full changelog" link.
- Welcome page (640px): hero headline, platform-aware key bindings card
  (`Cmd + Enter` on macOS, `Ctrl + Enter` elsewhere), default-sites list, and
  an "Open settings →" CTA. Staggered fade-in (0/80/160/240ms) respects
  `prefers-reduced-motion`.
- `src/shared/siteStatus.ts` shared `isReadyOn` readiness check, now reused by
  both the background icon state and the popup state dot.
- Project foundation: TypeScript, Vite (+ @crxjs/vite-plugin), ESLint, Prettier, EditorConfig.
- Directory layout for background, content, popup, options, welcome, shared, config, styles.
- Bundled EB Garamond, DM Sans, and JetBrains Mono `.woff2` files under `public/fonts/`.
- MV3 manifest with Chrome and Firefox variants, driven by the `TARGET` env var.
- Default-site config (`src/config/defaultSites.ts`) as the single source of truth
  for content-script match patterns: ChatGPT, Claude, Gemini, Perplexity, NotebookLM.
- Browser API wrapper (`src/shared/browser.ts`) over `webextension-polyfill`.
- Scaffold entrypoints for background, content, popup, options, and welcome surfaces.
- Placeholder solid-color toolbar icons (active / inactive, 16/32/48/128) via
  `scripts/render-icons.mjs` — proper branding lands later.

[Unreleased]: https://github.com/prashant-anand/enter-new-line/compare/HEAD...HEAD
