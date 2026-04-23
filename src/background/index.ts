import { runtime } from '@shared/browser';
import { runMigrations } from '@shared/storage';

runtime.onInstalled.addListener((details) => {
  console.warn('[EnterNewLine] onInstalled:', details.reason);
  void runMigrations().catch((err: unknown) => {
    console.error('[EnterNewLine] migration failed:', err);
  });
});
