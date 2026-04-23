/** Built-in supported sites. Keep this list as the single source of truth. */
export interface DefaultSite {
  readonly id: string;
  readonly label: string;
  readonly host: string;
  readonly matches: readonly string[];
}

function domainMatches(host: string): readonly string[] {
  return [`*://${host}/*`, `*://*.${host}/*`];
}

export const DEFAULT_SITES: readonly DefaultSite[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    host: 'chatgpt.com',
    matches: domainMatches('chatgpt.com'),
  },
  {
    id: 'claude',
    label: 'Claude',
    host: 'claude.ai',
    matches: domainMatches('claude.ai'),
  },
  {
    id: 'gemini',
    label: 'Gemini',
    host: 'gemini.google.com',
    matches: ['*://gemini.google.com/*'],
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    host: 'perplexity.ai',
    matches: domainMatches('perplexity.ai'),
  },
  {
    id: 'notebooklm',
    label: 'NotebookLM',
    host: 'notebooklm.google.com',
    matches: ['*://notebooklm.google.com/*'],
  },
];

export const DEFAULT_SITE_IDS: readonly string[] = DEFAULT_SITES.map((s) => s.id);

export const DEFAULT_CONTENT_SCRIPT_MATCHES: readonly string[] = DEFAULT_SITES.flatMap(
  (s) => s.matches,
);
