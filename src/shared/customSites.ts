/** Add/remove custom sites, coordinating permissions and persisted state.
 *
 * `addCustomSite` MUST be called from a user-gesture context (click, keydown).
 * MV3's `permissions.request` rejects silently otherwise.
 */

import { permissions } from './browser';
import { canonicalHost, isValidHost } from './matching';
import { getState, updateState } from './storage';

export function originsFor(host: string): string[] {
  return [`*://${host}/*`, `*://*.${host}/*`];
}

export type AddResult =
  | { status: 'ok'; host: string }
  | { status: 'invalid' }
  | { status: 'duplicate'; host: string }
  | { status: 'denied'; host: string };

export async function addCustomSite(rawHost: string): Promise<AddResult> {
  const host = canonicalHost(rawHost);
  if (!host || !isValidHost(host)) return { status: 'invalid' };

  const state = await getState();
  if (state.customSites.some((c) => c.host === host)) {
    return { status: 'duplicate', host };
  }

  const granted = await permissions.request({ origins: originsFor(host) });
  if (!granted) return { status: 'denied', host };

  await updateState((s) => ({
    ...s,
    customSites: [...s.customSites, { host, enabled: true, addedAt: Date.now() }],
    grantedCustomHosts: s.grantedCustomHosts.includes(host)
      ? s.grantedCustomHosts
      : [...s.grantedCustomHosts, host],
  }));

  return { status: 'ok', host };
}

export async function removeCustomSite(rawHost: string): Promise<void> {
  const host = canonicalHost(rawHost);
  if (!host) return;

  await updateState((s) => ({
    ...s,
    customSites: s.customSites.filter((c) => c.host !== host),
    grantedCustomHosts: s.grantedCustomHosts.filter((h) => h !== host),
  }));

  try {
    await permissions.remove({ origins: originsFor(host) });
  } catch {
    // Permission may already be absent or may fail silently on a missing origin.
  }
}

export async function setCustomSiteEnabled(rawHost: string, enabled: boolean): Promise<void> {
  const host = canonicalHost(rawHost);
  if (!host) return;
  await updateState((s) => ({
    ...s,
    customSites: s.customSites.map((c) => (c.host === host ? { ...c, enabled } : c)),
  }));
}
