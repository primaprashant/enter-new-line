import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineManifest } from '@crxjs/vite-plugin';
import { DEFAULT_CONTENT_SCRIPT_MATCHES } from './config/defaultSites';

/** Shared MV3 manifest with target-specific background settings. */
const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
  version: string;
};

const target = (process.env['TARGET'] ?? 'chrome') as 'chrome' | 'firefox';

const ICONS = {
  16: 'icons/active-16.png',
  32: 'icons/active-32.png',
  48: 'icons/active-48.png',
  128: 'icons/active-128.png',
} as const;

const COMMON = {
  manifest_version: 3 as const,
  name: 'EnterNewLine',
  short_name: 'EnterNewLine',
  description:
    'Enter inserts a new line. Ctrl/Cmd+Enter sends. Works on ChatGPT, Claude, Gemini, Perplexity, and NotebookLM.',
  version: pkg.version,
  icons: ICONS,
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'EnterNewLine',
    default_icon: ICONS,
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  permissions: ['storage', 'scripting'],
  optional_host_permissions: ['*://*/*'],
  content_scripts: [
    {
      matches: [...DEFAULT_CONTENT_SCRIPT_MATCHES],
      js: ['src/content/index.ts'],
      run_at: 'document_idle' as const,
      all_frames: false,
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/welcome/index.html'],
      matches: ['<all_urls>'],
    },
  ],
};

export default defineManifest(() => {
  if (target === 'firefox') {
    return {
      ...COMMON,
      background: {
        scripts: ['src/background/index.ts'],
      },
      browser_specific_settings: {
        gecko: {
          id: 'enternewline@prashant-anand.github.io',
          strict_min_version: '115.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    };
  }

  return {
    ...COMMON,
    background: {
      service_worker: 'src/background/index.ts',
      type: 'module' as const,
    },
  };
});
