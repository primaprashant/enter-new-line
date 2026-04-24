/**
 * In-memory fake of the slice of `webextension-polyfill` we use.
 *
 * Tests `import { fakeBrowser, resetBrowser } from './fakeBrowser'` to reach
 * into the registries (set up tabs, stage permission decisions, drive listeners).
 */

import type { Manifest, Tabs } from 'webextension-polyfill';

type Json = unknown;

// ── storage.sync ─────────────────────────────────────────────────────────────

type StorageChange = { oldValue?: Json; newValue?: Json };
type StorageListener = (changes: Record<string, StorageChange>, areaName: string) => void;

interface StorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, Json>>;
  set(items: Record<string, Json>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

function makeStorageArea(name: string): {
  area: StorageArea;
  data: Record<string, Json>;
} {
  const data: Record<string, Json> = {};
  const area: StorageArea = {
    async get(keys) {
      if (keys === undefined || keys === null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, Json> = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(items) {
      const changes: Record<string, StorageChange> = {};
      for (const [k, v] of Object.entries(items)) {
        const change: StorageChange = {};
        if (k in data) change.oldValue = data[k];
        change.newValue = v;
        changes[k] = change;
        data[k] = v;
      }
      for (const fn of [...storageListeners]) fn(changes, name);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes: Record<string, StorageChange> = {};
      for (const k of list) {
        if (!(k in data)) continue;
        changes[k] = { oldValue: data[k] };
        delete data[k];
      }
      if (Object.keys(changes).length > 0) {
        for (const fn of [...storageListeners]) fn(changes, name);
      }
    },
    async clear() {
      const changes: Record<string, StorageChange> = {};
      for (const [k, v] of Object.entries(data)) changes[k] = { oldValue: v };
      for (const k of Object.keys(data)) delete data[k];
      if (Object.keys(changes).length > 0) {
        for (const fn of [...storageListeners]) fn(changes, name);
      }
    },
  };
  return { area, data };
}

const sync = makeStorageArea('sync');
const local = makeStorageArea('local');
const storageListeners: StorageListener[] = [];

// ── runtime ──────────────────────────────────────────────────────────────────

type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => unknown;

type InstalledDetails = { reason: 'install' | 'update' | 'browser_update' | 'chrome_update' };
type InstalledListener = (details: InstalledDetails) => void;
type StartupListener = () => void;

const messageListeners: MessageListener[] = [];
const installedListeners: InstalledListener[] = [];
const startupListeners: StartupListener[] = [];
let manifest: Manifest.WebExtensionManifest = {
  manifest_version: 3,
  name: 'EnterNewLine',
  version: '0.0.0-test',
  content_scripts: [
    {
      matches: ['*://chatgpt.com/*'],
      js: ['assets/test-content.js'],
    },
  ],
};
let optionsPageOpens = 0;

// ── tabs ─────────────────────────────────────────────────────────────────────

type Tab = Tabs.Tab;
type ActivatedListener = (info: { tabId: number; windowId: number }) => void;
type UpdatedListener = (tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, tab: Tab) => void;

const tabsState: Tab[] = [];
const activatedListeners: ActivatedListener[] = [];
const updatedListeners: UpdatedListener[] = [];

// ── action ───────────────────────────────────────────────────────────────────

const setIconCalls: Array<{ tabId?: number; path: unknown }> = [];
const setTitleCalls: Array<{ tabId?: number; title: string }> = [];

// ── permissions ──────────────────────────────────────────────────────────────

type PermissionsListener = (perms: { origins?: string[]; permissions?: string[] }) => void;

const granted = new Set<string>();
let nextRequestDecision: 'grant' | 'deny' = 'grant';
const permissionsAddedListeners: PermissionsListener[] = [];
const permissionsRemovedListeners: PermissionsListener[] = [];

// ── scripting ────────────────────────────────────────────────────────────────

interface RegisteredScript {
  id: string;
  matches: string[];
  js: string[];
  runAt?: 'document_start' | 'document_end' | 'document_idle';
  allFrames?: boolean;
}

const registeredScripts: RegisteredScript[] = [];
const executeScriptCalls: Array<{ tabId: number; files: string[] }> = [];

// ── public surface (matches webextension-polyfill shape we use) ──────────────

export const fakeBrowser = {
  storage: {
    sync: sync.area,
    local: local.area,
    onChanged: {
      addListener(fn: StorageListener) {
        storageListeners.push(fn);
      },
      removeListener(fn: StorageListener) {
        const i = storageListeners.indexOf(fn);
        if (i >= 0) storageListeners.splice(i, 1);
      },
      hasListener(fn: StorageListener) {
        return storageListeners.includes(fn);
      },
    },
  },
  runtime: {
    onInstalled: {
      addListener(fn: InstalledListener) {
        installedListeners.push(fn);
      },
      removeListener(fn: InstalledListener) {
        const i = installedListeners.indexOf(fn);
        if (i >= 0) installedListeners.splice(i, 1);
      },
    },
    onStartup: {
      addListener(fn: StartupListener) {
        startupListeners.push(fn);
      },
      removeListener(fn: StartupListener) {
        const i = startupListeners.indexOf(fn);
        if (i >= 0) startupListeners.splice(i, 1);
      },
    },
    onMessage: {
      addListener(fn: MessageListener) {
        messageListeners.push(fn);
      },
      removeListener(fn: MessageListener) {
        const i = messageListeners.indexOf(fn);
        if (i >= 0) messageListeners.splice(i, 1);
      },
    },
    async sendMessage(message: unknown) {
      for (const fn of [...messageListeners]) {
        fn(message, { id: 'test-sender' }, () => undefined);
      }
      return undefined;
    },
    getManifest(): Manifest.WebExtensionManifest {
      return manifest;
    },
    getURL(path: string): string {
      return `chrome-extension://test/${path}`;
    },
    async openOptionsPage() {
      optionsPageOpens += 1;
    },
  },
  tabs: {
    async query(filter: Tabs.QueryQueryInfoType): Promise<Tab[]> {
      return tabsState.filter((t) => {
        if (filter.active === true && t.active !== true) return false;
        if (filter.currentWindow === true) {
          if (t.windowId !== 1) return false;
        }
        return true;
      });
    },
    async get(tabId: number): Promise<Tab> {
      const t = tabsState.find((x) => x.id === tabId);
      if (!t) throw new Error(`No tab with id ${tabId}`);
      return t;
    },
    async create(props: Tabs.CreateCreatePropertiesType): Promise<Tab> {
      const id = (tabsState.at(-1)?.id ?? 0) + 1;
      const tab: Tab = {
        id,
        index: tabsState.length,
        windowId: 1,
        active: true,
        pinned: false,
        highlighted: true,
        incognito: false,
        url: props.url,
        ...(typeof globalThis === 'object' ? {} : {}),
      } as Tab;
      tabsState.push(tab);
      return tab;
    },
    onActivated: {
      addListener(fn: ActivatedListener) {
        activatedListeners.push(fn);
      },
      removeListener(fn: ActivatedListener) {
        const i = activatedListeners.indexOf(fn);
        if (i >= 0) activatedListeners.splice(i, 1);
      },
    },
    onUpdated: {
      addListener(fn: UpdatedListener) {
        updatedListeners.push(fn);
      },
      removeListener(fn: UpdatedListener) {
        const i = updatedListeners.indexOf(fn);
        if (i >= 0) updatedListeners.splice(i, 1);
      },
    },
  },
  action: {
    async setIcon(details: { tabId?: number; path: unknown }) {
      setIconCalls.push(details);
    },
    async setTitle(details: { tabId?: number; title: string }) {
      setTitleCalls.push(details);
    },
  },
  permissions: {
    async request(perms: { origins?: string[] }): Promise<boolean> {
      if (nextRequestDecision === 'deny') return false;
      for (const o of perms.origins ?? []) granted.add(o);
      const listeners = [...permissionsAddedListeners];
      for (const fn of listeners) fn(perms);
      return true;
    },
    async contains(perms: { origins?: string[] }): Promise<boolean> {
      return (perms.origins ?? []).every((o) => granted.has(o));
    },
    async remove(perms: { origins?: string[] }): Promise<boolean> {
      let any = false;
      for (const o of perms.origins ?? []) {
        if (granted.delete(o)) any = true;
      }
      if (any) {
        const listeners = [...permissionsRemovedListeners];
        for (const fn of listeners) fn(perms);
      }
      return any;
    },
    onAdded: {
      addListener(fn: PermissionsListener) {
        permissionsAddedListeners.push(fn);
      },
      removeListener(fn: PermissionsListener) {
        const i = permissionsAddedListeners.indexOf(fn);
        if (i >= 0) permissionsAddedListeners.splice(i, 1);
      },
    },
    onRemoved: {
      addListener(fn: PermissionsListener) {
        permissionsRemovedListeners.push(fn);
      },
      removeListener(fn: PermissionsListener) {
        const i = permissionsRemovedListeners.indexOf(fn);
        if (i >= 0) permissionsRemovedListeners.splice(i, 1);
      },
    },
  },
  scripting: {
    async getRegisteredContentScripts(): Promise<RegisteredScript[]> {
      return registeredScripts.map((r) => ({ ...r }));
    },
    async registerContentScripts(scripts: RegisteredScript[]): Promise<void> {
      for (const s of scripts) {
        if (registeredScripts.some((r) => r.id === s.id)) {
          throw new Error(`Duplicate registration: ${s.id}`);
        }
        registeredScripts.push({ ...s });
      }
    },
    async unregisterContentScripts(filter: { ids: string[] }): Promise<void> {
      for (const id of filter.ids) {
        const i = registeredScripts.findIndex((r) => r.id === id);
        if (i >= 0) registeredScripts.splice(i, 1);
      }
    },
    async executeScript(opts: { target: { tabId: number }; files: string[] }): Promise<void> {
      executeScriptCalls.push({ tabId: opts.target.tabId, files: opts.files });
    },
  },
};

// ── test helpers ─────────────────────────────────────────────────────────────

export function resetBrowser(): void {
  for (const k of Object.keys(sync.data)) delete sync.data[k];
  for (const k of Object.keys(local.data)) delete local.data[k];
  storageListeners.length = 0;
  messageListeners.length = 0;
  installedListeners.length = 0;
  startupListeners.length = 0;
  tabsState.length = 0;
  activatedListeners.length = 0;
  updatedListeners.length = 0;
  setIconCalls.length = 0;
  setTitleCalls.length = 0;
  granted.clear();
  permissionsAddedListeners.length = 0;
  permissionsRemovedListeners.length = 0;
  registeredScripts.length = 0;
  executeScriptCalls.length = 0;
  nextRequestDecision = 'grant';
  optionsPageOpens = 0;
  manifest = {
    manifest_version: 3,
    name: 'EnterNewLine',
    version: '0.0.0-test',
    content_scripts: [
      {
        matches: ['*://chatgpt.com/*'],
        js: ['assets/test-content.js'],
      },
    ],
  };
}

export function setManifest(next: Manifest.WebExtensionManifest): void {
  manifest = next;
}

export function setNextPermissionDecision(decision: 'grant' | 'deny'): void {
  nextRequestDecision = decision;
}

export function grantOrigins(...origins: string[]): void {
  for (const o of origins) granted.add(o);
}

export function isGranted(origin: string): boolean {
  return granted.has(origin);
}

export function fakeTabs(): Tab[] {
  return tabsState;
}

export function pushTab(tab: Partial<Tab> & { id: number }): Tab {
  const full = {
    index: tabsState.length,
    windowId: 1,
    active: false,
    pinned: false,
    highlighted: false,
    incognito: false,
    ...tab,
  } as Tab;
  tabsState.push(full);
  return full;
}

export function emitOnInstalled(reason: InstalledDetails['reason'] = 'install'): void {
  for (const fn of [...installedListeners]) fn({ reason });
}

export function emitOnStartup(): void {
  for (const fn of [...startupListeners]) fn();
}

export function emitTabActivated(tabId: number, windowId = 1): void {
  for (const fn of [...activatedListeners]) fn({ tabId, windowId });
}

export function emitTabUpdated(
  tabId: number,
  changeInfo: Tabs.OnUpdatedChangeInfoType,
  tab: Tab,
): void {
  for (const fn of [...updatedListeners]) fn(tabId, changeInfo, tab);
}

export function setIconHistory(): Array<{ tabId?: number; path: unknown }> {
  return [...setIconCalls];
}

export function setTitleHistory(): Array<{ tabId?: number; title: string }> {
  return [...setTitleCalls];
}

export function registeredContentScripts(): RegisteredScript[] {
  return registeredScripts.map((r) => ({ ...r }));
}

export function executeScriptHistory(): Array<{ tabId: number; files: string[] }> {
  return [...executeScriptCalls];
}

export function optionsPageOpenCount(): number {
  return optionsPageOpens;
}

/** Trigger every onMessage listener and return the listener count that ran. */
export async function dispatchMessage(message: unknown): Promise<number> {
  const handlers = [...messageListeners];
  for (const fn of handlers) fn(message, { id: 'test-sender' }, () => undefined);
  return handlers.length;
}

/** Public access to sync storage for assertions (read-only by convention). */
export function syncStorage(): Record<string, Json> {
  return sync.data;
}
