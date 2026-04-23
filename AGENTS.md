# Repo Map

- `.docs/`: source-of-truth docs. Read `prd.md`, `design-system.md`, and `plan.md` before substantial product work.
- `src/`: extension source.
- `public/`: static packaged assets (`icons/`, `fonts/`).
- `scripts/`: one-off asset/build helper scripts.
- `dist/`: build output. Do not edit.
- `node_modules/`: vendor code. Ignore.

# `src/` Layout

- `background/`: MV3 background/service worker logic.
- `content/`: content script logic that runs on matched sites.
- `popup/`: browser action popup entry UI.
- `options/`: settings page entry UI.
- `welcome/`: first-run page entry UI.
- `shared/`: cross-context modules only: browser wrapper, schema, storage, matching, migrations, events, shared types/helpers.
- `config/`: static config and defaults, especially supported-site definitions.
- `styles/`: shared style tokens/base styles for extension pages.
- `manifest.config.ts`: manifest definition and browser-target differences.

# Placement Rules

- Put site-specific behavior in `content/`, not UI folders.
- Put persistent data shape, storage access, migrations, and matching logic in `shared/`.
- Put default supported sites in `src/config/defaultSites.ts`; treat it as the single source of truth.
- Keep extension page code (`popup`, `options`, `welcome`) isolated by surface; share only generic logic through `shared/` or `styles/`.
- Edit `public/` only for static assets that must ship as files.

# Working Notes

- Prefer reading `src/` and `.docs/`; skip `dist/` and `node_modules/`.
- Preserve the current modular structure and keep new files in the narrowest owning folder.
