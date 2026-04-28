/** Readiness check shared by the background icon logic and the popup UI. */

import { canonicalHost, resolveSite } from './matching';
import type { StoredState } from './schema';

/** True when the content script is expected to be running on `pageHost`. */
export function isReadyOn(pageHost: string, state: StoredState): boolean {
  const host = canonicalHost(pageHost);
  if (!host) return false;
  const site = resolveSite(host, state);
  if (!site) return false;
  if (!site.enabled) return false;
  return true;
}
