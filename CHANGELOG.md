# Changelog

All notable changes to EnterNewLine are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
