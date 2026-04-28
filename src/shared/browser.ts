/** Shared browser API surface for the rest of the extension. */
import browser from 'webextension-polyfill';

export { browser };

export const storage = browser.storage;
export const runtime = browser.runtime;
export const tabs = browser.tabs;
export const action = browser.action;

export function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox/');
}
