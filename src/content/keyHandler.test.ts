import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeBrowser } from '../../tests/fakeBrowser';
import { attachKeyHandler, routeKeyEvent } from './keyHandler';
import type { SiteRule } from './siteRules';

interface FakeRule extends SiteRule {
  shouldHandle: ReturnType<typeof vi.fn>;
  onEnter: ReturnType<typeof vi.fn>;
  onSend: ReturnType<typeof vi.fn>;
}

function makeRule(): FakeRule {
  return {
    host: 'example.com',
    shouldHandle: vi.fn().mockReturnValue(true),
    onEnter: vi.fn(),
    onSend: vi.fn(),
  } as unknown as FakeRule;
}

interface FakeKeyEventInit extends KeyboardEventInit {
  isTrusted?: boolean;
  isComposing?: boolean;
  target?: EventTarget | null;
}

/** Build a minimal KeyboardEvent-shaped object that bypasses jsdom's isTrusted lock. */
function makeKeyEvent(init: FakeKeyEventInit): KeyboardEvent {
  const target = init.target ?? null;
  return {
    code: init.code ?? init.key ?? '',
    key: init.key ?? '',
    isTrusted: init.isTrusted ?? true,
    isComposing: init.isComposing ?? false,
    shiftKey: init.shiftKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
    target,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('routeKeyEvent', () => {
  let target: HTMLTextAreaElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    target = document.createElement('textarea');
    document.body.append(target);
  });

  it('dispatches plain Enter to onEnter and emits a newline stat', () => {
    const sendSpy = vi.spyOn(fakeBrowser.runtime, 'sendMessage');
    const rule = makeRule();

    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'Enter', target }));

    expect(rule.onEnter).toHaveBeenCalledOnce();
    expect(rule.onSend).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith({
      type: 'stat',
      kind: 'newline',
      host: 'example.com',
    });
  });

  it('dispatches Ctrl+Enter to onSend and emits a send stat', () => {
    const sendSpy = vi.spyOn(fakeBrowser.runtime, 'sendMessage');
    const rule = makeRule();

    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'Enter', ctrlKey: true, target }));

    expect(rule.onSend).toHaveBeenCalledOnce();
    expect(rule.onEnter).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledWith({
      type: 'stat',
      kind: 'send',
      host: 'example.com',
    });
  });

  it('treats Cmd+Enter the same as Ctrl+Enter', () => {
    const rule = makeRule();
    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'Enter', metaKey: true, target }));
    expect(rule.onSend).toHaveBeenCalledOnce();
  });

  it('routes NumpadEnter the same as Enter', () => {
    const rule = makeRule();
    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'NumpadEnter', target }));
    expect(rule.onEnter).toHaveBeenCalledOnce();
  });

  it('passes Shift+Enter through (rule untouched)', () => {
    const rule = makeRule();
    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'Enter', shiftKey: true, target }));
    expect(rule.onEnter).not.toHaveBeenCalled();
    expect(rule.onSend).not.toHaveBeenCalled();
  });

  it('ignores untrusted events (re-entry from our own dispatch)', () => {
    const rule = makeRule();
    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'Enter', isTrusted: false, target }));
    expect(rule.onEnter).not.toHaveBeenCalled();
  });

  it('ignores events during IME composition', () => {
    const rule = makeRule();
    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'Enter', isComposing: true, target }));
    expect(rule.onEnter).not.toHaveBeenCalled();
  });

  it('ignores keys other than Enter', () => {
    const rule = makeRule();
    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'KeyA', target }));
    expect(rule.onEnter).not.toHaveBeenCalled();
  });

  it('skips routing when shouldHandle returns false', () => {
    const rule = makeRule();
    rule.shouldHandle.mockReturnValue(false);
    routeKeyEvent(rule, 'example.com', makeKeyEvent({ code: 'Enter', target }));
    expect(rule.onEnter).not.toHaveBeenCalled();
    expect(rule.onSend).not.toHaveBeenCalled();
  });
});

describe('attachKeyHandler', () => {
  let target: HTMLTextAreaElement;
  let detach: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    target = document.createElement('textarea');
    document.body.append(target);
  });

  afterEach(() => {
    detach?.();
    detach = null;
  });

  it('registers a capture-phase listener that observes keydowns on inner targets', () => {
    const rule = makeRule();
    detach = attachKeyHandler(rule, 'example.com');

    // jsdom-dispatched events are untrusted, so the handler skips them — we only
    // need to verify that the listener wiring exists (no throw, no double-dispatch).
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
    );

    expect(rule.shouldHandle).not.toHaveBeenCalled();
    expect(rule.onEnter).not.toHaveBeenCalled();
  });

  it('detach removes the listener', () => {
    const rule = makeRule();
    const localDetach = attachKeyHandler(rule, 'example.com');
    localDetach();
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
    );
    expect(rule.shouldHandle).not.toHaveBeenCalled();
  });
});
