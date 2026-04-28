import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveRule } from './siteRules';
import type { SiteRule } from './siteRules';

let recordedKeydowns: KeyboardEvent[] = [];
let captureListener: ((e: KeyboardEvent) => void) | null = null;

function recordKeydowns(): void {
  recordedKeydowns = [];
  captureListener = (e: KeyboardEvent) => {
    recordedKeydowns.push(e);
  };
  document.addEventListener('keydown', captureListener, { capture: true });
}

function untrustedKeydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

function dispatch(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const evt = untrustedKeydown(init);
  target.dispatchEvent(evt);
  return evt;
}

function ruleFor(host: string): SiteRule {
  const rule = resolveRule(host);
  if (!rule) throw new Error(`Expected rule for ${host}`);
  return rule;
}

beforeEach(() => {
  document.body.innerHTML = '';
  recordedKeydowns = [];
  captureListener = null;
});

afterEach(() => {
  if (captureListener) {
    document.removeEventListener('keydown', captureListener, { capture: true });
    captureListener = null;
  }
});

describe('resolveRule', () => {
  it('matches each default site by host', () => {
    expect(ruleFor('chatgpt.com').host).toBe('chatgpt.com');
    expect(ruleFor('foo.chatgpt.com').host).toBe('chatgpt.com');
    expect(ruleFor('claude.ai').host).toBe('claude.ai');
    expect(ruleFor('gemini.google.com').host).toBe('gemini.google.com');
    expect(ruleFor('perplexity.ai').host).toBe('perplexity.ai');
    expect(ruleFor('notebooklm.google.com').host).toBe('notebooklm.google.com');
  });

  it('does not cross-match google sibling subdomains', () => {
    expect(resolveRule('mail.google.com')).toBeNull();
    expect(resolveRule('google.com')).toBeNull();
  });

  it('returns null for unknown hosts', () => {
    expect(resolveRule('grok.com')).toBeNull();
  });
});

// ── ChatGPT ────────────────────────────────────────────────────────────────

describe('ChatGPT rule', () => {
  it('shouldHandle accepts only the prompt textarea', () => {
    const rule = ruleFor('chatgpt.com');
    const ta = document.createElement('textarea');
    ta.id = 'prompt-textarea';
    expect(rule.shouldHandle(ta)).toBe(true);
    const other = document.createElement('textarea');
    expect(rule.shouldHandle(other)).toBe(false);
    expect(rule.shouldHandle(document.createElement('div'))).toBe(false);
  });

  it('onEnter rewrites Enter to Shift+Enter on the prompt textarea', () => {
    const rule = ruleFor('chatgpt.com');
    const composer = document.createElement('textarea');
    composer.id = 'prompt-textarea';
    document.body.append(composer);
    recordKeydowns();

    const evt = dispatch(composer, { key: 'Enter', code: 'Enter' });
    rule.onEnter(evt);

    expect(evt.defaultPrevented).toBe(true);
    const shiftEnters = recordedKeydowns.filter((e) => e.key === 'Enter' && e.shiftKey);
    expect(shiftEnters).toHaveLength(1);
  });

  it('onSend re-dispatches with metaKey set', () => {
    const rule = ruleFor('chatgpt.com');
    const composer = document.createElement('textarea');
    composer.id = 'prompt-textarea';
    document.body.append(composer);
    recordKeydowns();

    const evt = dispatch(composer, { key: 'Enter', code: 'Enter', ctrlKey: true });
    rule.onSend(evt);

    expect(evt.defaultPrevented).toBe(true);
    const metaEnters = recordedKeydowns.filter((e) => e.metaKey && e.key === 'Enter');
    expect(metaEnters.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Claude ─────────────────────────────────────────────────────────────────

describe('Claude rule', () => {
  it('shouldHandle accepts contenteditable divs and textareas', () => {
    const rule = ruleFor('claude.ai');
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(rule.shouldHandle(div)).toBe(true);
    expect(rule.shouldHandle(document.createElement('textarea'))).toBe(true);
    expect(rule.shouldHandle(document.createElement('span'))).toBe(false);
  });

  it('onEnter inserts a newline into a textarea via the native value setter', () => {
    const rule = ruleFor('claude.ai');
    const ta = document.createElement('textarea');
    ta.value = 'hello';
    document.body.append(ta);
    ta.focus();
    ta.setSelectionRange(5, 5);

    const inputEvents: Event[] = [];
    ta.addEventListener('input', (e) => inputEvents.push(e));

    const evt = dispatch(ta, { key: 'Enter', code: 'Enter' });
    rule.onEnter(evt);

    expect(ta.value).toBe('hello\n');
    expect(ta.selectionStart).toBe(6);
    expect(ta.selectionEnd).toBe(6);
    expect(inputEvents).toHaveLength(1);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('onSend on a textarea clicks the nearest submit button', () => {
    const rule = ruleFor('claude.ai');
    const form = document.createElement('form');
    const ta = document.createElement('textarea');
    const submit = document.createElement('button');
    submit.type = 'submit';
    const click = vi.fn();
    submit.addEventListener('click', (event) => {
      event.preventDefault();
      click();
    });
    form.append(ta, submit);
    document.body.append(form);

    const evt = dispatch(ta, { key: 'Enter', code: 'Enter', metaKey: true });
    rule.onSend(evt);

    expect(click).toHaveBeenCalled();
    expect(evt.defaultPrevented).toBe(true);
  });

  it('onEnter on a contenteditable dispatches a synthetic Shift+Enter', () => {
    const rule = ruleFor('claude.ai');
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.append(div);
    recordKeydowns();

    const evt = dispatch(div, { key: 'Enter', code: 'Enter' });
    rule.onEnter(evt);

    expect(evt.defaultPrevented).toBe(true);
    const shifted = recordedKeydowns.filter((e) => e.shiftKey && e.key === 'Enter');
    expect(shifted.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Gemini ─────────────────────────────────────────────────────────────────

describe('Gemini rule', () => {
  it('shouldHandle accepts textarea and .ql-editor contenteditable only', () => {
    const rule = ruleFor('gemini.google.com');
    const ta = document.createElement('textarea');
    expect(rule.shouldHandle(ta)).toBe(true);

    const ql = document.createElement('div');
    ql.setAttribute('contenteditable', 'true');
    ql.classList.add('ql-editor');
    expect(rule.shouldHandle(ql)).toBe(true);

    const otherDiv = document.createElement('div');
    otherDiv.setAttribute('contenteditable', 'true');
    expect(rule.shouldHandle(otherDiv)).toBe(false);
  });

  it('onEnter does not preventDefault — it lets the page handle the synthetic Shift+Enter', () => {
    const rule = ruleFor('gemini.google.com');
    const ql = document.createElement('div');
    ql.setAttribute('contenteditable', 'true');
    ql.classList.add('ql-editor');
    document.body.append(ql);
    recordKeydowns();

    const evt = dispatch(ql, { key: 'Enter', code: 'Enter' });
    rule.onEnter(evt);

    expect(evt.defaultPrevented).toBe(false);
    const shifted = recordedKeydowns.filter((e) => e.shiftKey && e.key === 'Enter');
    expect(shifted.length).toBeGreaterThanOrEqual(1);
  });
});

// ── NotebookLM ──────────────────────────────────────────────────────────────

describe('NotebookLM rule', () => {
  it('shouldHandle is restricted to the query-box-input textarea', () => {
    const rule = ruleFor('notebooklm.google.com');
    const ta = document.createElement('textarea');
    ta.classList.add('query-box-input');
    expect(rule.shouldHandle(ta)).toBe(true);

    const other = document.createElement('textarea');
    expect(rule.shouldHandle(other)).toBe(false);
  });

  it('onSend clicks the query-box submit button', () => {
    const rule = ruleFor('notebooklm.google.com');
    const queryBox = document.createElement('query-box');
    const form = document.createElement('form');
    const ta = document.createElement('textarea');
    ta.classList.add('query-box-input');
    const submit = document.createElement('button');
    submit.type = 'submit';
    const click = vi.fn();
    submit.addEventListener('click', (event) => {
      event.preventDefault();
      click();
    });
    form.append(ta, submit);
    queryBox.append(form);
    document.body.append(queryBox);

    const evt = dispatch(ta, { key: 'Enter', code: 'Enter', metaKey: true });
    rule.onSend(evt);

    expect(click).toHaveBeenCalled();
  });
});
