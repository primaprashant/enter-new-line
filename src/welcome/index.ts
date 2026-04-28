import { DEFAULT_SITES } from '@config/defaultSites';
import { runtime, tabs } from '@shared/browser';

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
  $<HTMLSpanElement>('send-kbd').textContent = 'Ctrl + Enter';

  const binding = $<HTMLSpanElement>('send-binding');
  binding.replaceChildren();
  const ctrl = document.createElement('span');
  ctrl.className = 'kbd';
  ctrl.textContent = 'Ctrl';
  const plus = document.createElement('span');
  plus.setAttribute('aria-hidden', 'true');
  plus.textContent = '+';
  const enter = document.createElement('span');
  enter.className = 'kbd';
  enter.textContent = 'Enter';
  binding.append(ctrl, plus, enter);
}

function renderSites(): void {
  const list = $<HTMLUListElement>('welcome-sites');
  list.replaceChildren(
    ...DEFAULT_SITES.map((site) => {
      const li = document.createElement('li');
      li.className = 'welcome__site';

      const label = document.createElement('span');
      label.className = 'welcome__site-label';
      label.textContent = site.label;

      const host = document.createElement('span');
      host.className = 'welcome__site-host';
      host.textContent = site.host;

      li.append(label, host);
      return li;
    }),
  );
}

function wireCta(): void {
  $<HTMLButtonElement>('open-settings').addEventListener('click', () => {
    void openSettings();
  });
}

async function openSettings(): Promise<void> {
  try {
    await runtime.openOptionsPage();
  } catch (err) {
    console.warn('[EnterNewLine] openOptionsPage failed, opening options tab:', err);
    try {
      await tabs.create({ url: runtime.getURL('src/options/index.html') });
    } catch (fallbackErr) {
      console.warn('[EnterNewLine] failed to open options tab:', fallbackErr);
    }
  }
}

paintSendKey();
renderSites();
wireCta();
