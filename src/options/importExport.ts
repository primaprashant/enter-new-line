/** Import/export helpers for the options page. */

import { migrateState } from '@shared/migration';
import { type StoredState } from '@shared/schema';
import { getState, setState } from '@shared/storage';

const EXPORT_FILENAME = 'enternewline-settings.json';

export function exportToFile(state: StoredState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = EXPORT_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  disabledDefaults: number;
}

export async function applyImport(raw: unknown): Promise<ImportResult> {
  const incoming = migrateState(raw);
  const current = await getState();

  const merged: StoredState = {
    ...incoming,
    stats: current.stats,
  };

  await setState(merged);

  return {
    disabledDefaults: incoming.disabledDefaults.length,
  };
}

export function parseImportText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('That file is not valid JSON.');
  }
}
