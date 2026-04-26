import { DEFAULT_SITES, type DefaultSite } from '@config/defaultSites';
import { addCustomSite, removeCustomSite, setCustomSiteEnabled } from '@shared/customSites';
import { onStateChange } from '@shared/events';
import { canonicalHost, isValidHost } from '@shared/matching';
import { type CustomSite, type StoredState } from '@shared/schema';
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
  onRemove?: () => void;
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

  if (opts.onRemove) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn--destructive btn--compact';
    remove.textContent = 'Remove';
    remove.addEventListener('click', opts.onRemove);
    actions.append(remove);
  }

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

function renderCustoms(state: StoredState): void {
  const list = $<HTMLUListElement>('custom-sites');
  if (state.customSites.length === 0) {
    list.replaceChildren();
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No custom sites yet. Add one below.';
    list.append(empty);
    return;
  }

  const sorted = [...state.customSites].sort((a, b) => a.addedAt - b.addedAt);
  list.replaceChildren(
    ...sorted.map((site: CustomSite) =>
      siteRow({
        label: site.host,
        host: site.host,
        enabled: site.enabled,
        onToggle: () => {
          void setCustomSiteEnabled(site.host, !site.enabled);
        },
        onRemove: () => {
          if (!window.confirm(`Remove ${site.host} from your list?`)) return;
          void removeCustomSite(site.host).then(() => showToast(`Removed ${site.host}.`));
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

function attachAddForm(): void {
  const form = $<HTMLFormElement>('add-form');
  const input = $<HTMLInputElement>('add-input');
  const status = $<HTMLParagraphElement>('add-status');
  const submit = $<HTMLButtonElement>('add-submit');

  function setStatus(text: string, kind: 'ok' | 'error' | ''): void {
    status.textContent = text;
    status.classList.toggle('form__status--error', kind === 'error');
    status.classList.toggle('form__status--ok', kind === 'ok');
  }

  input.addEventListener('input', () => setStatus('', ''));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const host = canonicalHost(input.value);
    if (!host || !isValidHost(host)) {
      setStatus('Enter a valid domain, like grok.com.', 'error');
      return;
    }

    submit.disabled = true;
    setStatus('Requesting permission…', '');

    void addCustomSite(host)
      .then((result) => {
        if (result.status === 'ok') {
          input.value = '';
          setStatus(`Added ${result.host}.`, 'ok');
          showToast(`Added ${result.host}.`);
        } else if (result.status === 'duplicate') {
          setStatus(`${result.host} is already on your list.`, 'error');
        } else if (result.status === 'denied') {
          setStatus(
            `Permission for ${result.host} was not granted. Click Add again to retry.`,
            'error',
          );
        } else {
          setStatus('Enter a valid domain, like grok.com.', 'error');
        }
      })
      .catch((err: unknown) => {
        console.error('[EnterNewLine] add-site failed:', err);
        setStatus('Something went wrong. Try again.', 'error');
      })
      .finally(() => {
        submit.disabled = false;
      });
  });
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
  if (result.customSites === 0) return 'Imported settings.';
  if (result.deniedHosts === 0)
    return `Imported ${result.customSites} custom site${plural(result.customSites)}.`;
  return `Imported ${result.customSites} site${plural(result.customSites)}. ${result.deniedHosts} still need permission.`;
}

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

async function render(state?: StoredState): Promise<void> {
  const s = state ?? (await getState());
  renderDefaults(s);
  renderCustoms(s);
}

async function boot(): Promise<void> {
  attachAddForm();
  attachExport();
  attachImport();
  await render();
  onStateChange((next) => {
    void render(next);
  });
}

void boot();
