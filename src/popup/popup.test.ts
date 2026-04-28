import { beforeEach, describe, expect, it, vi } from 'vitest';

import popupHtml from './index.html?raw';
import { pushTab } from '../../tests/fakeBrowser';
import { setState } from '@shared/storage';
import { type StoredState } from '@shared/schema';

function mountPopup(): void {
  const doc = new DOMParser().parseFromString(popupHtml, 'text/html');
  doc.body.querySelectorAll('script').forEach((s) => s.remove());
  document.body.innerHTML = doc.body.innerHTML;
}

async function bootPopup(): Promise<void> {
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
  mountPopup();
});

describe('popup boot — supported default site', () => {
  it('renders the active state for an enabled default site', async () => {
    pushTab({
      id: 1,
      url: 'https://chatgpt.com/conversation',
      active: true,
      windowId: 1,
    });
    await setState(
      emptyState({
        stats: {
          global: { newlines: 5, sends: 2 },
          perHost: { 'chatgpt.com': { newlines: 4, sends: 1 } },
        },
      }),
    );

    await bootPopup();

    await vi.waitFor(() => {
      expect(document.getElementById('site-domain')?.textContent).toBe('chatgpt.com');
    });

    expect(document.getElementById('site-status')?.textContent).toBe('Active on chatgpt.com');
    expect(document.getElementById('site-toggle')?.getAttribute('aria-checked')).toBe('true');
    expect((document.getElementById('site-toggle') as HTMLButtonElement).disabled).toBe(false);
    expect(document.getElementById('state-label')?.textContent).toBe('Active');
    expect(document.getElementById('state-dot')?.classList.contains('state-dot--inactive')).toBe(
      false,
    );

    expect(document.getElementById('site-newlines')?.textContent).toBe('4');
    expect(document.getElementById('site-sends')?.textContent).toBe('1');
    expect(document.getElementById('global-newlines')?.textContent).toBe('5');
    expect(document.getElementById('global-sends')?.textContent).toBe('2');
  });

  it('toggling a default site writes to disabledDefaults and re-renders the row', async () => {
    pushTab({
      id: 1,
      url: 'https://chatgpt.com/',
      active: true,
      windowId: 1,
    });
    await setState(emptyState());

    await bootPopup();
    const toggle = document.getElementById('site-toggle') as HTMLButtonElement;
    await vi.waitFor(() => expect(toggle.disabled).toBe(false));

    toggle.click();
    await vi.waitFor(() => {
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });
    expect(document.getElementById('site-status')?.textContent).toBe('Paused on chatgpt.com');
  });
});

describe('popup boot — unsupported hosts and pages', () => {
  it('disables the toggle and explains for an unsupported http host', async () => {
    pushTab({
      id: 1,
      url: 'https://example.com/',
      active: true,
      windowId: 1,
    });
    await setState(emptyState());

    await bootPopup();
    await vi.waitFor(() => {
      expect(document.getElementById('site-domain')?.textContent).toBe('example.com');
    });

    expect(document.getElementById('site-status')?.textContent).toBe('Not available on this site');
    expect((document.getElementById('site-toggle') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables the toggle on chrome:// and other non-http URLs', async () => {
    pushTab({
      id: 1,
      url: 'chrome://extensions/',
      active: true,
      windowId: 1,
    });
    await setState(emptyState());

    await bootPopup();
    await vi.waitFor(() => {
      expect(document.getElementById('site-status')?.textContent).toBe(
        'Not available on this site',
      );
    });
    expect((document.getElementById('site-toggle') as HTMLButtonElement).disabled).toBe(true);
  });
});
