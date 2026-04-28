# EnterNewLine

[![CI](https://github.com/primaprashant/enter-new-line/actions/workflows/ci.yml/badge.svg)](https://github.com/primaprashant/enter-new-line/actions/workflows/ci.yml)

Bind **Enter** to insert a new line and **Ctrl+Enter** / **Cmd+Enter** to send on
ChatGPT, Claude, Gemini, Perplexity, and NotebookLM. Stop sending half-finished
prompts.

- Works on Chrome and Firefox (Manifest V3)
- No data leaves the browser — no analytics, no network calls
  ([privacy policy](PRIVACY.md))
- MIT licensed, fully open source

## Supported sites (default)

- chatgpt.com
- claude.ai
- gemini.google.com
- perplexity.ai
- notebooklm.google.com

Custom sites are not supported; the extension intentionally keeps host permissions limited to this default list.

## Development

Requirements: Node 20+.

```sh
npm install
npm run fonts:fetch   # one-time; downloads EB Garamond, DM Sans, JetBrains Mono .woff2 into public/fonts/
npm run icons:render  # one-time; generates placeholder toolbar icons into public/icons/
npm run build:chrome  # emits the loadable extension at dist/chrome/
```

### Scripts

| Script                    | Description                                   |
| ------------------------- | --------------------------------------------- |
| `npm run dev`             | Vite dev server with HMR (defaults to Chrome) |
| `npm run build`           | Production build (defaults to Chrome)         |
| `npm run build:chrome`    | Build to `dist/chrome/`                       |
| `npm run build:firefox`   | Build to `dist/firefox/`                      |
| `npm run typecheck`       | TypeScript check (no emit)                    |
| `npm run lint`            | ESLint                                        |
| `npm run format`          | Prettier (write)                              |
| `npm run fonts:fetch`     | Re-download bundled font files                |
| `npm run icons:render`    | Regenerate placeholder toolbar icons          |
| `npm run package:chrome`  | Build + zip Chrome package into `release/`    |
| `npm run package:firefox` | Build + zip Firefox `.xpi` into `release/`    |
| `npm run package`         | Both of the above                             |

### Loading the extension locally

- **Chrome**: run `npm run build:chrome`, then open `chrome://extensions`,
  enable Developer mode, and **Load unpacked** pointing to `dist/chrome/`.
- **Firefox**: run `npm run build:firefox`, open `about:debugging#/runtime/this-firefox`,
  click **Load Temporary Add-on…**, and select
  `dist/firefox/manifest.json`.

After loading, open the devtools console on a supported site (`chatgpt.com`,
`claude.ai`, etc.) to confirm the content script attached.

## Project layout

```
src/
  background/   # MV3 service worker / event page
  content/      # Content scripts (key interception)
  popup/        # Toolbar popup UI
  options/      # Full-page settings
  welcome/      # First-run page
  shared/       # Browser API wrapper, storage, utils
  config/       # Default site list, schema versions
  styles/       # Design-system tokens & shared CSS
public/
  icons/        # Extension icons (active/inactive, 16/32/48/128)
  fonts/        # Locally bundled .woff2 files (CSP-safe)
scripts/        # Build-time tooling (font fetcher, icon renderer)
```

## Packaging & release

Store-ready archives are produced by the package scripts:

```sh
npm run package          # writes release/enter-new-line-<version>-chrome.zip
                         # and   release/enter-new-line-<version>-firefox.xpi
```

The script requires the `zip` binary (present on macOS, Linux, and the
GitHub Actions `ubuntu-latest` runner). Sourcemaps and `fonts/README.md` are
excluded from the upload.

Releases are cut by pushing a `v<version>` tag (matching `package.json`):

```sh
git tag v0.1.0
git push origin v0.1.0
```

The `Release` workflow rebuilds, packages, and attaches both archives to a
GitHub release with auto-generated notes. CI must be green and the tag must
match `package.json` `version`, or the workflow fails fast.

## Privacy

EnterNewLine collects no data. See [PRIVACY.md](PRIVACY.md) for the full
policy.

## License

[MIT](LICENSE) © Prashant Anand
