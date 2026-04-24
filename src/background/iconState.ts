/** Per-tab browser-action icon and title based on extension readiness. */

import { action, tabs } from '@shared/browser';
import { canonicalHost } from '@shared/matching';
import { isReadyOn } from '@shared/siteStatus';
import { getState } from '@shared/storage';
import type { StoredState } from '@shared/schema';

const ACTIVE_ICONS = {
  16: 'icons/active-16.png',
  32: 'icons/active-32.png',
  48: 'icons/active-48.png',
  128: 'icons/active-128.png',
} as const;

const INACTIVE_ICONS = {
  16: 'icons/inactive-16.png',
  32: 'icons/inactive-32.png',
  48: 'icons/inactive-48.png',
  128: 'icons/inactive-128.png',
} as const;

function hostFromUrl(url: string | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return canonicalHost(u.hostname);
  } catch {
    return '';
  }
}

export async function updateIconForTab(
  tabId: number,
  url: string | undefined,
  state?: StoredState,
): Promise<void> {
  const s = state ?? (await getState());
  const host = hostFromUrl(url);
  const active = isReadyOn(host, s);

  const path = active ? ACTIVE_ICONS : INACTIVE_ICONS;
  const title = active
    ? `EnterNewLine — active on ${host}`
    : 'EnterNewLine — not active on this page';

  try {
    await Promise.all([
      action.setIcon({ tabId, path: { ...path } }),
      action.setTitle({ tabId, title }),
    ]);
  } catch {
    // Some tabs (chrome://, view-source://, etc.) reject per-tab action mutations; silently skip.
  }
}

export async function refreshAllTabs(state?: StoredState): Promise<void> {
  const s = state ?? (await getState());
  const all = await tabs.query({});
  await Promise.all(
    all.map((t) => {
      if (t.id === undefined) return Promise.resolve();
      return updateIconForTab(t.id, t.url ?? undefined, s);
    }),
  );
}
