/** Import/export helpers for the options page. */

import { permissions } from '@shared/browser';
import { originsFor } from '@shared/customSites';
import { migrateState } from '@shared/migration';
import { type StoredState } from '@shared/schema';
import { getState, setState } from '@shared/storage';

const EXPORT_FILENAME = 'enternewline-settings.json';

export function exportToFile(state: StoredState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = EXPORT_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  /** Total custom sites carried across from the file. */
  customSites: number;
  /** Custom hosts that the browser granted permission for (now usable). */
  grantedHosts: number;
  /** Custom hosts the user declined or the browser rejected. */
  deniedHosts: number;
}

export async function applyImport(raw: unknown): Promise<ImportResult> {
  const incoming = migrateState(raw);
  const neededHosts = incoming.customSites.map((s) => s.host);
  const origins = neededHosts.flatMap(originsFor);

  if (origins.length > 0) {
    await permissions.request({ origins }).catch(() => false as const);
  }

  const [current, grantedHosts] = await Promise.all([getState(), grantedHostsFor(neededHosts)]);

  const merged: StoredState = {
    ...incoming,
    stats: current.stats,
    grantedCustomHosts: grantedHosts,
  };

  await setState(merged);

  return {
    customSites: incoming.customSites.length,
    grantedHosts: grantedHosts.length,
    deniedHosts: neededHosts.length - grantedHosts.length,
  };
}

export function parseImportText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('That file is not valid JSON.');
  }
}

async function grantedHostsFor(hosts: readonly string[]): Promise<string[]> {
  const checks = await Promise.all(
    hosts.map(async (host) => {
      const ok = await permissions.contains({ origins: originsFor(host) }).catch(() => false);
      return ok ? host : null;
    }),
  );
  return checks.filter((host): host is string => host !== null);
}
