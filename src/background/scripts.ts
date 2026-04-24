import { permissions, runtime, scripting, tabs } from '@shared/browser';
import { hostMatches } from '@shared/matching';
import { getState, updateState } from '@shared/storage';
import { originsFor } from '@shared/customSites';

const ID_PREFIX = 'ensl-custom-';

function idFor(host: string): string {
  return ID_PREFIX + host;
}

function contentScriptFile(): string | null {
  const manifest = runtime.getManifest();
  const cs = manifest.content_scripts?.[0];
  return cs?.js?.[0] ?? null;
}

function matchesFor(host: string): string[] {
  return [`*://${host}/*`, `*://*.${host}/*`];
}

function urlMatchesAnyHost(url: string | undefined, hosts: readonly string[]): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return hosts.some((host) => hostMatches(u.hostname, host));
  } catch {
    return false;
  }
}

async function injectIntoOpenTabs(file: string, hosts: readonly string[]): Promise<void> {
  if (hosts.length === 0) return;
  const allTabs = await tabs.query({});
  await Promise.all(
    allTabs.map(async (tab) => {
      if (tab.id === undefined || !urlMatchesAnyHost(tab.url ?? undefined, hosts)) return;
      try {
        await scripting.executeScript({ target: { tabId: tab.id }, files: [file] });
      } catch {
        // Ignore tabs that reject injection because they are restricted or mid-navigation.
      }
    }),
  );
}

export async function syncCustomSiteRegistrations(): Promise<void> {
  const file = contentScriptFile();
  if (!file) return;

  const state = await getState();
  const desired = new Set(state.grantedCustomHosts);

  let existing: Awaited<ReturnType<typeof scripting.getRegisteredContentScripts>> = [];
  try {
    existing = await scripting.getRegisteredContentScripts();
  } catch {
    existing = [];
  }

  const existingOurs = existing.filter((r) => r.id.startsWith(ID_PREFIX));
  const existingIds = new Set(existingOurs.map((r) => r.id));

  const toUnregister = existingOurs
    .filter((r) => !desired.has(r.id.slice(ID_PREFIX.length)))
    .map((r) => r.id);

  const toRegister = [...desired].filter((h) => !existingIds.has(idFor(h)));

  if (toUnregister.length > 0) {
    try {
      await scripting.unregisterContentScripts({ ids: toUnregister });
    } catch (err) {
      console.warn('[EnterNewLine] unregisterContentScripts failed:', err);
    }
  }

  if (toRegister.length > 0) {
    try {
      await scripting.registerContentScripts(
        toRegister.map((host) => ({
          id: idFor(host),
          matches: matchesFor(host),
          js: [file],
          runAt: 'document_idle' as const,
          allFrames: false,
        })),
      );
      await injectIntoOpenTabs(file, toRegister);
    } catch (err) {
      console.warn('[EnterNewLine] registerContentScripts failed:', err);
    }
  }
}

export async function reconcileGrantedPermissions(): Promise<void> {
  const state = await getState();
  if (state.grantedCustomHosts.length === 0) return;

  const checks = await Promise.all(
    state.grantedCustomHosts.map(async (host) => {
      try {
        const ok = await permissions.contains({ origins: originsFor(host) });
        return { host, ok };
      } catch {
        return { host, ok: true };
      }
    }),
  );

  const stillGranted = checks.filter((c) => c.ok).map((c) => c.host);
  if (stillGranted.length === state.grantedCustomHosts.length) return;

  await updateState((s) => ({ ...s, grantedCustomHosts: stillGranted }));
}
