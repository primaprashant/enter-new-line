import { runtime } from '@shared/browser';

runtime.onInstalled.addListener((details) => {
  console.warn('[EnterNewLine] onInstalled:', details.reason);
});
