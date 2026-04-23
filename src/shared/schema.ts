/** Persistent state schema for EnterNewLine. */

export const SCHEMA_VERSION = 1;

/** storage.sync key for the full state blob. */
export const STORAGE_KEY = 'state';

export interface SiteStats {
  /** Times Enter was intercepted and converted to a newline. */
  newlines: number;
  /** Times Ctrl/Cmd+Enter was used to send. */
  sends: number;
}

export interface Stats {
  global: SiteStats;
  /** Per-site counters keyed by canonical host. */
  perHost: Record<string, SiteStats>;
}

export interface CustomSite {
  /** Canonical host (lowercased, no protocol/path/port). */
  host: string;
  /** Whether the extension is currently active on this site. */
  enabled: boolean;
  /** Unix-ms timestamp for stable ordering. */
  addedAt: number;
}

export interface StoredState {
  schemaVersion: number;
  /** IDs of default sites the user has explicitly toggled off. */
  disabledDefaults: string[];
  customSites: CustomSite[];
  /** Hosts for which optional host permission was granted. */
  grantedCustomHosts: string[];
  stats: Stats;
}

export function emptySiteStats(): SiteStats {
  return { newlines: 0, sends: 0 };
}

export function createInitialState(): StoredState {
  return {
    schemaVersion: SCHEMA_VERSION,
    disabledDefaults: [],
    customSites: [],
    grantedCustomHosts: [],
    stats: {
      global: emptySiteStats(),
      perHost: {},
    },
  };
}
