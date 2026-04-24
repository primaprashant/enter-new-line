/** Capture-phase keydown router that dispatches to a SiteRule. */

import { sendStat } from '@shared/messages';
import type { SiteRule } from './siteRules';

function isEnterKey(event: KeyboardEvent): boolean {
  return event.code === 'Enter' || event.code === 'NumpadEnter';
}

/** Pure routing logic, exported for tests. */
export function routeKeyEvent(rule: SiteRule, host: string, event: KeyboardEvent): void {
  if (!event.isTrusted) return;
  if (event.isComposing) return;
  if (!isEnterKey(event)) return;

  if (event.shiftKey) return;

  if (!rule.shouldHandle(event.target)) return;

  const isSend = event.ctrlKey || event.metaKey;
  if (isSend) {
    rule.onSend(event);
    sendStat('send', host);
  } else {
    rule.onEnter(event);
    sendStat('newline', host);
  }
}

/** Attach the capture-phase router and return a detach function. */
export function attachKeyHandler(rule: SiteRule, host: string): () => void {
  const handler = (event: KeyboardEvent): void => {
    routeKeyEvent(rule, host, event);
  };

  document.addEventListener('keydown', handler, { capture: true });
  return () => {
    document.removeEventListener('keydown', handler, { capture: true });
  };
}
