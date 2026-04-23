# Bundled fonts

Latin subset `.woff2` files for EnterNewLine UI surfaces. Bundled locally
so extension pages can load them under MV3 CSP without remote fetches.

Regenerate with:

    npm run fonts:fetch

## Face → file

| Family | Weight | Style | File |
|---|---|---|---|
| DM Sans | 400 | normal | `dm-sans.woff2` |
| DM Sans | 500 | normal | `dm-sans.woff2` |
| DM Sans | 700 | normal | `dm-sans.woff2` |
| EB Garamond | 400 | italic | `eb-garamond-italic.woff2` |
| EB Garamond | 400 | normal | `eb-garamond.woff2` |
| EB Garamond | 500 | normal | `eb-garamond.woff2` |
| JetBrains Mono | 400 | normal | `jetbrains-mono.woff2` |
| JetBrains Mono | 500 | normal | `jetbrains-mono.woff2` |

Google Fonts serves variable fonts where available, so a single file may
cover multiple weights — `@font-face` declarations in `src/styles/` should
use a weight range (e.g. `font-weight: 400 700`) against the same file.
