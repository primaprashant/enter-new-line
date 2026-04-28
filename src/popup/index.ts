import { runtime, tabs } from '@shared/browser';
import { onStateChange } from '@shared/events';
import { canonicalHost, resolveSite, type ResolvedSite } from '@shared/matching';
import { emptySiteStats, type SiteStats, type StoredState } from '@shared/schema';
import { isReadyOn } from '@shared/siteStatus';
import { getState, updateState } from '@shared/storage';

interface TabContext {
  readonly host: string;
  readonly supported: boolean;
}

function $<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[EnterNewLine] missing element #${id}`);
  return el as unknown as T;
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform ?? '';
  if (/Mac|iPhone|iPad/i.test(platform)) return true;
  return /Macintosh/i.test(navigator.userAgent ?? '');
}

function paintSendKey(): void {
  if (isMacPlatform()) return;
  $<HTMLSpanElement>('send-key').textContent = 'Ctrl + Enter';
}

async function activeTabContext(): Promise<TabContext> {
  const [tab] = await tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;
  if (!url) return { host: '', supported: false };
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { host: '', supported: false };
    }
    return { host: canonicalHost(u.hostname), supported: true };
  } catch {
    return { host: '', supported: false };
  }
}

function numberFormat(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function statsFor(host: string, state: StoredState): SiteStats {
  if (!host) return emptySiteStats();
  return state.stats.perHost[host] ?? emptySiteStats();
}

function paintStats(ctx: TabContext, site: ResolvedSite | null, state: StoredState): void {
  const perSite = statsFor(site?.host ?? ctx.host, state);
  $('site-newlines').textContent = numberFormat(perSite.newlines);
  $('site-sends').textContent = numberFormat(perSite.sends);
  $('global-newlines').textContent = numberFormat(state.stats.global.newlines);
  $('global-sends').textContent = numberFormat(state.stats.global.sends);
}

function paintSiteRow(ctx: TabContext, site: ResolvedSite | null, state: StoredState): void {
  const domain = $<HTMLSpanElement>('site-domain');
  const status = $<HTMLSpanElement>('site-status');
  const toggle = $<HTMLButtonElement>('site-toggle');
  const dot = $<HTMLSpanElement>('state-dot');
  const srLabel = $<HTMLSpanElement>('state-label');

  if (!ctx.supported) {
    domain.textContent = 'This page';
    domain.removeAttribute('title');
    status.textContent = 'Not available on this site';
    toggle.setAttribute('aria-checked', 'false');
    toggle.disabled = true;
    toggle.setAttribute('aria-label', 'Toggle unavailable on this page');
    dot.classList.add('state-dot--inactive');
    srLabel.textContent = 'Inactive';
    return;
  }

  if (!site) {
    domain.textContent = ctx.host || 'This page';
    domain.title = ctx.host;
    status.textContent = 'Not available on this site';
    toggle.setAttribute('aria-checked', 'false');
    toggle.disabled = true;
    toggle.setAttribute('aria-label', `Toggle unavailable on ${ctx.host}`);
    dot.classList.add('state-dot--inactive');
    srLabel.textContent = 'Inactive';
    return;
  }

  const ready = isReadyOn(ctx.host, state);
  domain.textContent = site.host;
  domain.title = site.host;
  status.textContent = site.enabled ? `Active on ${site.host}` : `Paused on ${site.host}`;
  toggle.setAttribute('aria-checked', site.enabled ? 'true' : 'false');
  toggle.disabled = false;
  toggle.setAttribute(
    'aria-label',
    site.enabled ? `Pause on ${site.host}` : `Activate on ${site.host}`,
  );
  dot.classList.toggle('state-dot--inactive', !ready);
  srLabel.textContent = ready ? 'Active' : 'Inactive';
}

async function toggleCurrentSite(ctx: TabContext): Promise<void> {
  const state = await getState();
  const site = ctx.host ? resolveSite(ctx.host, state) : null;
  if (!site) return;

  await updateState((s) => {
    const disabled = new Set(s.disabledDefaults);
    if (site.enabled) disabled.add(site.id);
    else disabled.delete(site.id);
    return { ...s, disabledDefaults: [...disabled] };
  });
}

async function render(ctx: TabContext, state?: StoredState): Promise<void> {
  const s = state ?? (await getState());
  const site = ctx.host ? resolveSite(ctx.host, s) : null;
  paintSiteRow(ctx, site, s);
  paintStats(ctx, site, s);
}

async function boot(): Promise<void> {
  paintSendKey();
  const ctx = await activeTabContext();
  await render(ctx);

  $<HTMLButtonElement>('site-toggle').addEventListener('click', () => {
    void toggleCurrentSite(ctx);
  });

  $<HTMLButtonElement>('open-settings').addEventListener('click', () => {
    void runtime.openOptionsPage().catch((err: unknown) => {
      console.warn('[EnterNewLine] openOptionsPage failed:', err);
    });
    // Close the popup so focus follows the new tab.
    window.close();
  });

  onStateChange((next) => {
    void render(ctx, next);
  });
}

void boot();
