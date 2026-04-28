import { DEFAULT_SITES, type DefaultSite } from '@config/defaultSites';
import { onStateChange } from '@shared/events';
import { type StoredState } from '@shared/schema';
import { getState, updateState } from '@shared/storage';

import { applyImport, exportToFile, parseImportText, type ImportResult } from './importExport';

function $<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[EnterNewLine] missing element #${id}`);
  return el as unknown as T;
}

function siteRow(opts: {
  label: string;
  host: string;
  enabled: boolean;
  onToggle: () => void;
}): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'site';

  const copy = document.createElement('div');
  copy.className = 'site__copy';

  const label = document.createElement('span');
  label.className = 'site__label';
  label.textContent = opts.label;

  const host = document.createElement('span');
  host.className = 'site__host';
  host.textContent = opts.host;
  host.title = opts.host;

  copy.append(label, host);

  const actions = document.createElement('div');
  actions.className = 'site__actions';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toggle';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', opts.enabled ? 'true' : 'false');
  toggle.setAttribute(
    'aria-label',
    opts.enabled ? `Pause on ${opts.host}` : `Activate on ${opts.host}`,
  );
  const thumb = document.createElement('span');
  thumb.className = 'toggle__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  toggle.append(thumb);
  toggle.addEventListener('click', opts.onToggle);
  actions.append(toggle);

  li.append(copy, actions);
  return li;
}

function renderDefaults(state: StoredState): void {
  const list = $<HTMLUListElement>('default-sites');
  list.replaceChildren(
    ...DEFAULT_SITES.map((site: DefaultSite) =>
      siteRow({
        label: site.label,
        host: site.host,
        enabled: !state.disabledDefaults.includes(site.id),
        onToggle: () => {
          void updateState((s) => {
            const disabled = new Set(s.disabledDefaults);
            if (disabled.has(site.id)) disabled.delete(site.id);
            else disabled.add(site.id);
            return { ...s, disabledDefaults: [...disabled] };
          });
        },
      }),
    ),
  );
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, kind: 'ok' | 'error' = 'ok'): void {
  const toast = $<HTMLDivElement>('toast');
  toast.textContent = message;
  toast.classList.toggle('toast--error', kind === 'error');
  toast.classList.add('toast--visible');
  toast.removeAttribute('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, 3000);
}

function attachExport(): void {
  $<HTMLButtonElement>('export-btn').addEventListener('click', () => {
    void getState()
      .then((state) => {
        exportToFile(state);
        showToast('Settings exported.');
      })
      .catch((err: unknown) => {
        console.error('[EnterNewLine] export failed:', err);
        showToast('Export failed.', 'error');
      });
  });
}

function attachImport(): void {
  const file = $<HTMLInputElement>('import-file');

  $<HTMLButtonElement>('import-btn').addEventListener('click', () => {
    file.value = '';
    file.click();
  });

  file.addEventListener('change', () => {
    const picked = file.files?.[0];
    if (!picked) return;

    void picked
      .text()
      .then((text) => applyImport(parseImportText(text)))
      .then((result: ImportResult) => {
        showToast(importSummary(result));
      })
      .catch((err: unknown) => {
        console.error('[EnterNewLine] import failed:', err);
        const message = err instanceof Error ? err.message : 'Import failed.';
        showToast(message, 'error');
      });
  });
}

function importSummary(result: ImportResult): string {
  if (result.disabledDefaults === 0) return 'Imported settings.';
  return 'Imported site settings.';
}

async function render(state?: StoredState): Promise<void> {
  const s = state ?? (await getState());
  renderDefaults(s);
}

async function boot(): Promise<void> {
  attachExport();
  attachImport();
  await render();
  onStateChange((next) => {
    void render(next);
  });
}

void boot();
