/** Host normalization and site matching helpers. */

import { DEFAULT_SITES } from '@config/defaultSites';
import type { StoredState } from './schema';

/** Normalize user or page input into a bare lowercase host. */
export function canonicalHost(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';

  let host = trimmed;
  const scheme = host.indexOf('://');
  if (scheme !== -1) host = host.slice(scheme + 3);

  // Rare but legal in URL input.
  const at = host.lastIndexOf('@');
  if (at !== -1) host = host.slice(at + 1);

  const slash = host.indexOf('/');
  if (slash !== -1) host = host.slice(0, slash);

  const question = host.indexOf('?');
  if (question !== -1) host = host.slice(0, question);

  const hash = host.indexOf('#');
  if (hash !== -1) host = host.slice(0, hash);

  const colon = host.indexOf(':');
  if (colon !== -1) host = host.slice(0, colon);

  if (host.startsWith('.')) host = host.slice(1);
  if (host.endsWith('.')) host = host.slice(0, -1);

  return host;
}

/** Validate a host for use as a stored site identifier. */
export function isValidHost(host: string): boolean {
  if (!host) return false;
  if (host.length > 253) return false;

  const labels = host.split('.');
  if (labels.length < 2) return false;

  const labelRe = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!labels.every((label) => labelRe.test(label))) return false;

  // Crude IPv4 filter.
  const tld = labels[labels.length - 1];
  if (tld === undefined || /^[0-9]+$/.test(tld)) return false;

  return true;
}

/** True when `pageHost` equals `siteHost` or is one of its subdomains. */
export function hostMatches(pageHost: string, siteHost: string): boolean {
  const page = canonicalHost(pageHost);
  const site = canonicalHost(siteHost);
  if (!page || !site) return false;
  return page === site || page.endsWith('.' + site);
}

export type ResolvedSite = {
  readonly kind: 'default';
  readonly id: string;
  readonly host: string;
  readonly label: string;
  readonly enabled: boolean;
};

/** Resolve a page host to the default site that owns it. */
export function resolveSite(pageHost: string, state: StoredState): ResolvedSite | null {
  const host = canonicalHost(pageHost);
  if (!host) return null;

  for (const d of DEFAULT_SITES) {
    if (hostMatches(host, d.host)) {
      return {
        kind: 'default',
        id: d.id,
        host: d.host,
        label: d.label,
        enabled: !state.disabledDefaults.includes(d.id),
      };
    }
  }

  return null;
}

/** Bucket per-site stats by canonical host. */
export function siteStatsKey(site: ResolvedSite): string {
  return site.host;
}
