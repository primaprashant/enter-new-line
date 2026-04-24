import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import optionsHtml from './index.html?raw';
import { fakeBrowser, setNextPermissionDecision } from '../../tests/fakeBrowser';
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
    customSites: [],
    grantedCustomHosts: [],
    stats: { global: { newlines: 0, sends: 0 }, perHost: {} },
    ...overrides,
  };
}

let originalConfirm: typeof window.confirm;

beforeEach(() => {
  document.body.innerHTML = '';
  mountOptions();
  originalConfirm = window.confirm;
});

afterEach(() => {
  window.confirm = originalConfirm;
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

    const geminiRow = rows[2]!;
    expect(geminiRow.querySelector('.toggle')?.getAttribute('aria-checked')).toBe('false');

    const chatgptRow = rows[0]!;
    expect(chatgptRow.querySelector('.toggle')?.getAttribute('aria-checked')).toBe('true');
  });

  it('shows the empty-state copy when no custom sites exist', async () => {
    await setState(emptyState());
    await bootOptions();

    await vi.waitFor(() => {
      const empty = document.querySelector('#custom-sites .empty');
      expect(empty?.textContent).toBe('No custom sites yet. Add one below.');
    });
  });

  it('renders custom sites in addedAt order', async () => {
    await setState(
      emptyState({
        customSites: [
          { host: 'b.com', enabled: true, addedAt: 200 },
          { host: 'a.com', enabled: false, addedAt: 100 },
        ],
        grantedCustomHosts: ['b.com', 'a.com'],
      }),
    );
    await bootOptions();

    await vi.waitFor(() => {
      const rows = document.querySelectorAll('#custom-sites .site');
      expect(rows.length).toBe(2);
    });

    const rows = Array.from(document.querySelectorAll('#custom-sites .site'));
    const hosts = rows.map((r) => r.querySelector('.site__host')?.textContent ?? '');
    expect(hosts).toEqual(['a.com', 'b.com']);
  });
});

describe('options page — add a site', () => {
  it('rejects an invalid host without prompting for permission', async () => {
    const requestSpy = vi.spyOn(fakeBrowser.permissions, 'request');
    await setState(emptyState());
    await bootOptions();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('#default-sites .site').length).toBe(5),
    );

    const input = document.getElementById('add-input') as HTMLInputElement;
    const form = document.getElementById('add-form') as HTMLFormElement;
    input.value = 'not a host';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('add-status')?.textContent).toBe(
        'Enter a valid domain, like grok.com.',
      );
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('adds a valid host after the user grants permission', async () => {
    setNextPermissionDecision('grant');
    await setState(emptyState());
    await bootOptions();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('#default-sites .site').length).toBe(5),
    );

    const input = document.getElementById('add-input') as HTMLInputElement;
    const form = document.getElementById('add-form') as HTMLFormElement;
    input.value = 'grok.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const rows = document.querySelectorAll('#custom-sites .site');
      expect(rows.length).toBe(1);
    });
    expect(document.querySelector('#custom-sites .site__host')?.textContent).toBe('grok.com');
    expect(document.getElementById('add-status')?.textContent).toBe('Added grok.com.');
    expect(input.value).toBe('');
  });

  it('reports a denied permission and leaves state untouched', async () => {
    setNextPermissionDecision('deny');
    await setState(emptyState());
    await bootOptions();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('#default-sites .site').length).toBe(5),
    );

    const input = document.getElementById('add-input') as HTMLInputElement;
    const form = document.getElementById('add-form') as HTMLFormElement;
    input.value = 'grok.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('add-status')?.textContent).toContain(
        'Permission for grok.com was not granted',
      );
    });
    expect(document.querySelectorAll('#custom-sites .site').length).toBe(0);
  });

  it('reports a duplicate without prompting', async () => {
    const requestSpy = vi.spyOn(fakeBrowser.permissions, 'request');
    await setState(
      emptyState({
        customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
        grantedCustomHosts: ['grok.com'],
      }),
    );
    await bootOptions();
    await vi.waitFor(() => expect(document.querySelectorAll('#custom-sites .site').length).toBe(1));

    const input = document.getElementById('add-input') as HTMLInputElement;
    const form = document.getElementById('add-form') as HTMLFormElement;
    input.value = 'grok.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById('add-status')?.textContent).toBe(
        'grok.com is already on your list.',
      );
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });
});

describe('options page — remove a site', () => {
  it('asks for confirmation and removes the site when accepted', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    await setState(
      emptyState({
        customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
        grantedCustomHosts: ['grok.com'],
      }),
    );
    await bootOptions();
    await vi.waitFor(() => expect(document.querySelectorAll('#custom-sites .site').length).toBe(1));

    const removeBtn = document.querySelector(
      '#custom-sites .btn--destructive',
    ) as HTMLButtonElement;
    removeBtn.click();

    await vi.waitFor(() => {
      expect(document.querySelector('#custom-sites .empty')?.textContent).toBe(
        'No custom sites yet. Add one below.',
      );
    });
    expect(window.confirm).toHaveBeenCalledWith('Remove grok.com from your list?');
  });

  it('keeps the site when the user cancels the confirm dialog', async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    await setState(
      emptyState({
        customSites: [{ host: 'grok.com', enabled: true, addedAt: 1 }],
        grantedCustomHosts: ['grok.com'],
      }),
    );
    await bootOptions();
    await vi.waitFor(() => expect(document.querySelectorAll('#custom-sites .site').length).toBe(1));

    const removeBtn = document.querySelector(
      '#custom-sites .btn--destructive',
    ) as HTMLButtonElement;
    removeBtn.click();

    // Allow any pending micro-tasks to settle, then verify the row is still there.
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelectorAll('#custom-sites .site').length).toBe(1);
  });
});

describe('options page — import flow', () => {
  it('parses the picked file, batches the permission request, and shows a success toast', async () => {
    setNextPermissionDecision('grant');
    const requestSpy = vi.spyOn(fakeBrowser.permissions, 'request');
    await setState(emptyState());
    await bootOptions();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('#default-sites .site').length).toBe(5),
    );

    const blob = JSON.stringify({
      schemaVersion: 1,
      disabledDefaults: ['gemini'],
      customSites: [
        { host: 'grok.com', enabled: true, addedAt: 1 },
        { host: 'qwen.ai', enabled: true, addedAt: 2 },
      ],
      grantedCustomHosts: [],
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
      expect(document.getElementById('toast')?.textContent).toBe('Imported 2 custom sites.');
    });

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy.mock.calls[0]?.[0]?.origins).toEqual([
      '*://grok.com/*',
      '*://*.grok.com/*',
      '*://qwen.ai/*',
      '*://*.qwen.ai/*',
    ]);
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
