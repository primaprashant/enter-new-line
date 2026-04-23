/** Shape and version migrations for the persisted state. */

import { DEFAULT_SITES } from '@config/defaultSites';
import {
  type CustomSite,
  SCHEMA_VERSION,
  type SiteStats,
  type Stats,
  type StoredState,
  createInitialState,
  emptySiteStats,
} from './schema';
import { canonicalHost, isValidHost } from './matching';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function sanitizeSiteStats(value: unknown): SiteStats {
  if (!isRecord(value)) return emptySiteStats();
  const newlines = typeof value['newlines'] === 'number' ? value['newlines'] : 0;
  const sends = typeof value['sends'] === 'number' ? value['sends'] : 0;
  return {
    newlines: Number.isFinite(newlines) && newlines >= 0 ? newlines : 0,
    sends: Number.isFinite(sends) && sends >= 0 ? sends : 0,
  };
}

function sanitizeStats(value: unknown): Stats {
  if (!isRecord(value)) return { global: emptySiteStats(), perHost: {} };
  const perHostRaw = value['perHost'];
  const perHost: Record<string, SiteStats> = {};
  if (isRecord(perHostRaw)) {
    for (const [key, entry] of Object.entries(perHostRaw)) {
      const host = canonicalHost(key);
      if (!host) continue;
      perHost[host] = sanitizeSiteStats(entry);
    }
  }
  return {
    global: sanitizeSiteStats(value['global']),
    perHost,
  };
}

function sanitizeCustomSite(value: unknown): CustomSite | null {
  if (!isRecord(value)) return null;
  const host = canonicalHost(typeof value['host'] === 'string' ? value['host'] : '');
  if (!host || !isValidHost(host)) return null;
  const enabled = typeof value['enabled'] === 'boolean' ? value['enabled'] : true;
  const addedAtRaw = value['addedAt'];
  const addedAt =
    typeof addedAtRaw === 'number' && Number.isFinite(addedAtRaw) && addedAtRaw >= 0
      ? addedAtRaw
      : 0;
  return { host, enabled, addedAt };
}

function sanitizeCustomSites(value: unknown): CustomSite[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: CustomSite[] = [];
  for (const entry of value) {
    const site = sanitizeCustomSite(entry);
    if (!site) continue;
    if (seen.has(site.host)) continue;
    seen.add(site.host);
    out.push(site);
  }
  return out;
}

/** Transform any persisted blob into a valid current-version `StoredState`. */
export function migrateState(raw: unknown): StoredState {
  if (!isRecord(raw)) return createInitialState();

  // Future: `if (raw.schemaVersion === 1) raw = migrateV1toV2(raw);`

  const state: StoredState = {
    schemaVersion: SCHEMA_VERSION,
    disabledDefaults: [...new Set(sanitizeStringArray(raw['disabledDefaults']))],
    customSites: sanitizeCustomSites(raw['customSites']),
    grantedCustomHosts: sanitizeStringArray(raw['grantedCustomHosts'])
      .map(canonicalHost)
      .filter(isValidHost)
      .filter(Boolean),
    stats: sanitizeStats(raw['stats']),
  };

  // Auto-clean after a default site is removed in an update.
  const knownDefaultIds = new Set(DEFAULT_SITES.map((d) => d.id));
  state.disabledDefaults = state.disabledDefaults.filter((id) => knownDefaultIds.has(id));

  state.grantedCustomHosts = [...new Set(state.grantedCustomHosts)];

  return state;
}
