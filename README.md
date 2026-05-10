# EnterNewLine

[![CI](https://github.com/primaprashant/enter-new-line/actions/workflows/ci.yml/badge.svg)](https://github.com/primaprashant/enter-new-line/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Stop accidentally sending half-finished prompts.

A browser extension that rebinds **Enter** to insert a new line and **Cmd+Enter** / **Ctrl+Enter** to send on ChatGPT, Claude, Gemini, Perplexity, and NotebookLM.

If you write long prompts, you've hit the bug: you reach for a paragraph break and the site fires off the message instead. EnterNewLine swaps the two so the keys behave like every other text editor.

- Chrome and Firefox, Manifest V3
- No data collection, no telemetry, no network calls — see [PRIVACY.md](PRIVACY.md)
- MIT licensed, fully auditable

## Install

- **Chrome Web Store** — https://chromewebstore.google.com/detail/enternewline-%E2%80%94-bind-enter/ingflmkenbhkjhbhcphjjdhpmnnagphp
- **Firefox Add-ons** — _coming soon_
- **From source** — see [Development](#development)

## How it works

| Keypress                       | Behavior                 |
| ------------------------------ | ------------------------ |
| `Enter`                        | Insert a new line        |
| `Cmd + Enter` / `Ctrl + Enter` | Send the message         |
| `Shift + Enter`                | Unchanged (site default) |

Only the primary chat input is intercepted (textarea, contenteditable, ProseMirror). Search bars, chat-rename fields, and other inputs are untouched. Paste behavior is unaffected.

## Where it works

| Site       | Domain                  |
| ---------- | ----------------------- |
| ChatGPT    | `chatgpt.com`           |
| Claude     | `claude.ai`             |
| Gemini     | `gemini.google.com`     |
| Perplexity | `perplexity.ai`         |
| NotebookLM | `notebooklm.google.com` |

Toggle each site on or off from the popup, or manage them all from the settings page. Custom sites are intentionally out of scope so the extension can keep a narrow, review-friendly host-permission footprint.

Settings persist in `storage.sync`, so they follow you across devices on the same browser account. Import/export as JSON if you need to move them anywhere else.

## Privacy

EnterNewLine collects nothing. No analytics, no telemetry, no network requests. The newline/send counters shown in the popup are stored locally for your eyes only. Full policy in [PRIVACY.md](PRIVACY.md).

## Development

Requires Node 20+.

```sh
npm install
npm run fonts:fetch    # one-time: fetches bundled .woff2 files
npm run icons:render   # one-time: renders toolbar icons
npm run build:chrome   # → dist/chrome/
npm run build:firefox  # → dist/firefox/
```

### Load the unpacked build

- **Chrome** — `chrome://extensions` → Developer mode → **Load unpacked** → `dist/chrome/`
- **Firefox** — `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → `dist/firefox/manifest.json`

### Common scripts

| Script              | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Vite dev server with HMR (Chrome target)                     |
| `npm run typecheck` | TypeScript, no emit                                          |
| `npm run lint`      | ESLint                                                       |
| `npm run test`      | Vitest                                                       |
| `npm run package`   | Build and zip Chrome `.zip` + Firefox `.xpi` into `release/` |

### Project layout

```
src/
  background/   MV3 service worker
  content/      Key interception, per site
  popup/        Toolbar popup
  options/      Settings page
  welcome/      First-run page
  shared/       Browser API wrapper, storage, schema, matching, migrations
  config/       Default site list (single source of truth)
  styles/       Design-system tokens
public/         Static assets shipped with the extension (icons, fonts)
scripts/        Build-time helpers (font fetcher, icon renderer, packager)
.docs/          Product docs (PRD, design system, copy)
```

Product, design, and copy decisions live in [`.docs/`](.docs/). Read those before substantial product work.

### Releasing

Tag the commit with `v<version>` matching `package.json`:

```sh
git tag v0.1.0 && git push origin v0.1.0
```

The `Release` workflow rebuilds, packages, and attaches the Chrome `.zip` and Firefox `.xpi` to a GitHub release. CI must be green and the tag must match `package.json#version`, or the workflow fails fast.

## Contributing

Bug reports, feature requests, and pull requests are welcome. For non-trivial changes, open an issue first so we can align on scope.

## License

[MIT](LICENSE) © Prashant Anand
