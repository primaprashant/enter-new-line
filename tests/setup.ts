import { afterEach, beforeEach, vi } from 'vitest';
import { fakeBrowser, resetBrowser } from './fakeBrowser';

// Replace `webextension-polyfill` everywhere it's imported (e.g. via @shared/browser).
vi.mock('webextension-polyfill', () => ({
  default: fakeBrowser,
}));

// jsdom doesn't implement `HTMLElement.isContentEditable`, which our content-script
// rules depend on. Polyfill it from the `contenteditable` attribute for tests.
if (typeof HTMLElement !== 'undefined' && !('isContentEditable' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
    get(this: HTMLElement) {
      const v = this.getAttribute('contenteditable');
      return v === '' || v === 'true' || v === 'plaintext-only';
    },
    configurable: true,
  });
}

// The site-rule tests assert clicks, not native form submission.
if (typeof HTMLFormElement !== 'undefined') {
  HTMLFormElement.prototype.requestSubmit = function requestSubmit() {
    /* no-op stub */
  };
}

// jsdom doesn't ship URL.createObjectURL/revokeObjectURL — the export flow
// uses both. Stub with a deterministic blob:test/<n> URL.
if (typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => `blob:test/${++counter}`,
    configurable: true,
    writable: true,
  });
}
if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    configurable: true,
    writable: true,
  });
}

// jsdom 25 still doesn't implement Blob.prototype.text — polyfill via FileReader
// so the import flow can read its picked file.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsText(this);
    });
  };
}

beforeEach(() => {
  resetBrowser();
});

afterEach(() => {
  vi.useRealTimers();
});
