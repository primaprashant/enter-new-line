import { beforeEach, describe, expect, it, vi } from 'vitest';

import optionsHtml from './index.html?raw';
import { setState } from '@shared/storage';
import { type StoredState } from '@shared/schema';

function mountOptions(): void {
  const doc = new DOMParser().parseFromString(optionsHtml, 'text/html');
  doc.body.querySelectorAll('script').forEach((s) => s.remove());
  document.body.innerHTML = doc.body.innerHTML;
}

async function bootOptions(): Promise<void> {
  vi.resetModules();
  await import('./index');
}

function emptyState(overrides: Partial<StoredState> = {}): StoredState {
  return {
    schemaVersion: 1,
    disabledDefaults: [],
    stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  mountOptions();
});

describe('options page render', () => {
  it('lists every default site with a toggle reflecting disabledDefaults', async () => {
    await setState(emptyState({ disabledDefaults: ['gemini'] }));
    await bootOptions();

    await vi.waitFor(() => {
      const rows = document.querySelectorAll('#default-sites .site');
      expect(rows.length).toBe(5);
    });

    const rows = Array.from(document.querySelectorAll('#default-sites .site'));
    const labels = rows.map((r) => r.querySelector('.site__label')?.textContent ?? '');
    expect(labels).toEqual(['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'NotebookLM']);

    expect(rows[2]?.querySelector('.toggle')?.getAttribute('aria-checked')).toBe('false');
    expect(rows[0]?.querySelector('.toggle')?.getAttribute('aria-checked')).toBe('true');
    expect(document.getElementById('custom-sites')).toBeNull();
    expect(document.getElementById('add-form')).toBeNull();
  });

  it('toggles a default site into disabledDefaults', async () => {
    await setState(emptyState());
    await bootOptions();

    await vi.waitFor(() =>
      expect(document.querySelectorAll('#default-sites .site').length).toBe(5),
    );

    const firstToggle = document.querySelector('#default-sites .toggle') as HTMLButtonElement;
    firstToggle.click();

    await vi.waitFor(() => {
      const updatedToggle = document.querySelector('#default-sites .toggle') as HTMLButtonElement;
      expect(updatedToggle.getAttribute('aria-checked')).toBe('false');
    });
  });
});

describe('options page import flow', () => {
  it('imports default-site settings without requesting host permissions', async () => {
    await setState(emptyState());
    await bootOptions();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('#default-sites .site').length).toBe(5),
    );

    const blob = JSON.stringify({
      schemaVersion: 1,
      disabledDefaults: ['gemini'],
      customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
      grantedCustomHosts: ['grok.com'],
      stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    });
    const file = new File([blob], 'settings.json', { type: 'application/json' });

    const fileInput = document.getElementById('import-file') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: {
        length: 1,
        0: file,
        item: (i: number) => (i === 0 ? file : null),
      } as unknown as FileList,
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toBe('Imported site settings.');
    });
  });

  it('shows an error toast on invalid JSON', async () => {
    await setState(emptyState());
    await bootOptions();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('#default-sites .site').length).toBe(5),
    );

    const file = new File(['not json'], 'broken.json', { type: 'application/json' });
    const fileInput = document.getElementById('import-file') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: {
        length: 1,
        0: file,
        item: (i: number) => (i === 0 ? file : null),
      } as unknown as FileList,
      configurable: true,
    });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toBe('That file is not valid JSON.');
    });
    expect(document.getElementById('toast')?.classList.contains('toast--error')).toBe(true);
  });
});
