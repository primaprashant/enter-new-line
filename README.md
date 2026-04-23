# EnterNewLine

Bind **Enter** to insert a new line and **Ctrl+Enter** / **Cmd+Enter** to send on
ChatGPT, Claude, Gemini, Perplexity, and NotebookLM. Stop sending half-finished
prompts.

- Works on Chrome and Firefox (Manifest V3)
- No data leaves the browser — no analytics, no network calls
- MIT licensed, fully open source

## Supported sites (default)

- chatgpt.com
- claude.ai
- gemini.google.com
- perplexity.ai
- notebooklm.google.com

Custom sites can be added from the options page.

## Development

Requirements: Node 20+.

```sh
npm install
npm run fonts:fetch   # one-time; downloads EB Garamond, DM Sans, JetBrains Mono .woff2 into public/fonts/
npm run dev           # Vite scaffold build; Phase 2 wires the extension manifest
```

### Scripts

| Script                  | Description                      |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Vite scaffold build with HMR     |
| `npm run build`         | Production scaffold build        |
| `npm run build:chrome`  | Scaffold build to `dist/chrome`  |
| `npm run build:firefox` | Scaffold build to `dist/firefox` |
| `npm run typecheck`     | TypeScript check (no emit)       |
| `npm run lint`          | ESLint                           |
| `npm run format`        | Prettier (write)                 |
| `npm run fonts:fetch`   | Re-download bundled font files   |

### Loading the extension locally

Phase 2 will introduce the manifest and extension entrypoints. After that lands,
load the built extension via:

- **Chrome**: `chrome://extensions` → Developer mode → Load unpacked
- **Firefox**: `about:debugging` → This Firefox → Load Temporary Add-on

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
```

## License

[MIT](LICENSE) © Prashant Anand
