/** Content-script bootstrap. */

import { canonicalHost, resolveSite } from '@shared/matching';
import { getState } from '@shared/storage';
import { onStateChange } from '@shared/events';
import type { StoredState } from '@shared/schema';

import { resolveRule } from './siteRules';
import { attachKeyHandler } from './keyHandler';

const pageHost = canonicalHost(location.hostname);
const rule = resolveRule(pageHost);

let detach: (() => void) | null = null;

function isEnabledOn(state: StoredState): boolean {
  const site = resolveSite(pageHost, state);
  // Default sites are manifest-matched, so treat them as active until storage catches up.
  if (!site) return rule.host !== '*';
  return site.enabled;
}

function sync(state: StoredState): void {
  const shouldBeAttached = isEnabledOn(state);
  if (shouldBeAttached && !detach) {
    detach = attachKeyHandler(rule, pageHost);
  } else if (!shouldBeAttached && detach) {
    detach();
    detach = null;
  }
}

void getState()
  .then(sync)
  .catch((err: unknown) => {
    console.warn('[EnterNewLine] initial state load failed:', err);
  });

onStateChange((next) => {
  sync(next);
});
