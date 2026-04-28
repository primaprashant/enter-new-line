/** Per-site key interception rules. */

import { hostMatches } from '@shared/matching';

export interface SiteRule {
  /** Canonical host this rule claims (matched via `hostMatches`). */
  readonly host: string;
  /** True if `target` is the site's primary chat input. */
  readonly shouldHandle: (target: EventTarget | null) => boolean;
  /** Handler for plain Enter. Must preventDefault if it intercepts. */
  readonly onEnter: (event: KeyboardEvent) => void;
  /** Handler for Ctrl/Meta+Enter. Must preventDefault if it intercepts. */
  readonly onSend: (event: KeyboardEvent) => void;
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

function isContentEditableDiv(el: EventTarget | null): el is HTMLDivElement {
  return el instanceof HTMLDivElement && el.isContentEditable;
}

function isTextarea(el: EventTarget | null): el is HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement;
}

function dispatchEnter(target: EventTarget, options: Partial<KeyboardEventInit> = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
      composed: true,
      ...options,
    }),
  );
}

/** Insert a newline via the native textarea setter so controlled inputs notice. */
function insertTextareaNewline(el: HTMLTextAreaElement): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + '\n' + el.value.slice(end);

  const proto = Object.getPrototypeOf(el) as HTMLTextAreaElement;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  const nativeSetter = descriptor?.set;
  if (nativeSetter) nativeSetter.call(el, next);
  else el.value = next;

  el.selectionStart = el.selectionEnd = start + 1;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Click the first enabled `<button type="submit">` inside the nearest form. */
function clickNearestSubmit(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const form = target.closest('form');
  const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]:not([disabled])');
  if (!button) return false;
  button.click();
  return true;
}

// ── Default site rules ──────────────────────────────────────────────────────

const CHATGPT: SiteRule = {
  host: 'chatgpt.com',
  shouldHandle(target) {
    return target instanceof HTMLElement && target.id === 'prompt-textarea';
  },
  onEnter(event) {
    if (!(event.target instanceof HTMLElement)) return;
    event.preventDefault();
    dispatchEnter(event.target, { shiftKey: true });
  },
  onSend(event) {
    if (!event.target) return;
    event.preventDefault();
    // ChatGPT listens for meta+Enter, even when the user pressed Ctrl+Enter.
    dispatchEnter(event.target, { metaKey: true });
  },
};

const CLAUDE: SiteRule = {
  host: 'claude.ai',
  shouldHandle(target) {
    return isContentEditableDiv(target) || isTextarea(target);
  },
  onEnter(event) {
    const target = event.target;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatchEnter(target, { shiftKey: true });
    if (isTextarea(target)) insertTextareaNewline(target);
  },
  onSend(event) {
    const target = event.target;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatchEnter(target, {});
    if (isTextarea(target)) clickNearestSubmit(target);
  },
};

const GEMINI: SiteRule = {
  host: 'gemini.google.com',
  shouldHandle(target) {
    if (isTextarea(target)) return true;
    return isContentEditableDiv(target) && target.classList.contains('ql-editor');
  },
  onEnter(event) {
    if (!event.target) return;
    event.stopImmediatePropagation();
    dispatchEnter(event.target, { shiftKey: true });
  },
  onSend(event) {
    if (!event.target) return;
    event.stopImmediatePropagation();
    dispatchEnter(event.target, {});
  },
};

const PERPLEXITY: SiteRule = {
  host: 'perplexity.ai',
  shouldHandle(target) {
    return isContentEditableDiv(target) || isTextarea(target);
  },
  onEnter(event) {
    if (!event.target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatchEnter(event.target, { shiftKey: true });
  },
  onSend(event) {
    if (!event.target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatchEnter(event.target, {});
  },
};

const NOTEBOOKLM: SiteRule = {
  host: 'notebooklm.google.com',
  shouldHandle(target) {
    return isTextarea(target) && target.classList.contains('query-box-input');
  },
  onEnter(event) {
    if (!event.target) return;
    event.stopImmediatePropagation();
    dispatchEnter(event.target, { shiftKey: true });
  },
  onSend(event) {
    if (!event.target) return;
    event.stopImmediatePropagation();
    dispatchEnter(event.target, {});
    const submit = document.querySelector<HTMLButtonElement>(
      'query-box form button[type="submit"]',
    );
    submit?.click();
  },
};

const DEFAULT_RULES: readonly SiteRule[] = [CHATGPT, CLAUDE, GEMINI, PERPLEXITY, NOTEBOOKLM];

/** Find the rule for a canonical page host. */
export function resolveRule(pageHost: string): SiteRule | null {
  for (const rule of DEFAULT_RULES) {
    if (hostMatches(pageHost, rule.host)) return rule;
  }
  return null;
}
