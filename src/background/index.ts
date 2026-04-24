/** Background service worker entrypoint. */

import { permissions, runtime, tabs } from '@shared/browser';
import { onStateChange } from '@shared/events';
import type { StoredState } from '@shared/schema';
import { runMigrations } from '@shared/storage';

import { refreshAllTabs, updateIconForTab } from './iconState';
import { reconcileGrantedPermissions, syncCustomSiteRegistrations } from './scripts';
import { installStatsListener } from './stats';

const WELCOME_PAGE = 'src/welcome/index.html';

// ── Boot ────────────────────────────────────────────────────────────────────

async function bootstrap(reason: string): Promise<void> {
  try {
    await runMigrations();
    await reconcileGrantedPermissions();
    await syncCustomSiteRegistrations();
    await refreshAllTabs();
  } catch (err) {
    console.error(`[EnterNewLine] bootstrap (${reason}) failed:`, err);
  }
}

runtime.onInstalled.addListener((details) => {
  console.warn('[EnterNewLine] onInstalled:', details.reason);
  void bootstrap(`install:${details.reason}`);

  if (details.reason === 'install') {
    void tabs.create({ url: runtime.getURL(WELCOME_PAGE) }).catch((err: unknown) => {
      console.warn('[EnterNewLine] failed to open welcome tab:', err);
    });
  }
});

runtime.onStartup.addListener(() => {
  void bootstrap('startup');
});

installStatsListener();

// ── Icon state ──────────────────────────────────────────────────────────────

tabs.onActivated.addListener((info) => {
  void tabs
    .get(info.tabId)
    .then((tab) => updateIconForTab(info.tabId, tab.url ?? undefined))
    .catch(() => {
      /* tab may have closed between activation and query */
    });
});

tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // React to both full loads and SPA URL changes.
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  void updateIconForTab(tabId, tab.url ?? undefined);
});

// ── State reactions ─────────────────────────────────────────────────────────

/**
 * Skip reactions when only `stats` changed — stats writes fire on every flush
 * and neither the icon nor script registry depend on them.
 */
function isStructurallyChanged(prev: StoredState | null, next: StoredState): boolean {
  if (!prev) return true;
  if (prev.disabledDefaults.join('|') !== next.disabledDefaults.join('|')) return true;
  if (prev.grantedCustomHosts.join('|') !== next.grantedCustomHosts.join('|')) return true;
  if (prev.customSites.length !== next.customSites.length) return true;
  for (let i = 0; i < prev.customSites.length; i++) {
    const a = prev.customSites[i];
    const b = next.customSites[i];
    if (a?.host !== b?.host || a?.enabled !== b?.enabled) return true;
  }
  return false;
}

onStateChange((next, prev) => {
  if (!isStructurallyChanged(prev, next)) return;
  void syncCustomSiteRegistrations();
  void refreshAllTabs(next);
});

// ── Permission reactions ────────────────────────────────────────────────────

permissions.onAdded.addListener(() => {
  void syncCustomSiteRegistrations();
});

permissions.onRemoved.addListener(() => {
  void reconcileGrantedPermissions().then(() => syncCustomSiteRegistrations());
});
