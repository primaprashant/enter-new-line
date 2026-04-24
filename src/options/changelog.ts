/** Small Keep-a-Changelog parser for the bundled CHANGELOG.md. */

import rawChangelog from '../../CHANGELOG.md?raw';

export interface ChangelogGroup {
  readonly kind: string;
  readonly items: readonly string[];
}

export interface ChangelogEntry {
  readonly title: string;
  readonly groups: readonly ChangelogGroup[];
}

function formatTitle(heading: string): string {
  const match = heading.match(/^\[([^\]]+)\](?:\s*-\s*(.+))?$/);
  if (!match) return heading;
  const [, version = heading, date] = match;
  return date ? `${version} — ${date}` : version;
}

export function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = raw.split(/\r?\n/);

  let entry: { title: string; groups: ChangelogGroup[] } | null = null;
  let group: { kind: string; items: string[] } | null = null;

  for (const line of lines) {
    if (/^##\s+/.test(line) && !/^###\s/.test(line)) {
      entry = { title: formatTitle(line.replace(/^##\s+/, '').trim()), groups: [] };
      entries.push(entry);
      group = null;
      continue;
    }

    if (!entry) continue;

    if (/^###\s+/.test(line)) {
      group = { kind: line.replace(/^###\s+/, '').trim(), items: [] };
      entry.groups.push(group);
      continue;
    }

    if (/^-\s+/.test(line)) {
      if (!group) {
        group = { kind: '', items: [] };
        entry.groups.push(group);
      }
      group.items.push(line.replace(/^-\s+/, '').trim());
      continue;
    }

    // Continuation of the prior bullet (leading whitespace + non-empty).
    if (/^\s+\S/.test(line) && group && group.items.length > 0) {
      const idx = group.items.length - 1;
      group.items[idx] = `${group.items[idx] ?? ''} ${line.trim()}`;
    }
  }

  return entries;
}

export function loadChangelog(): ChangelogEntry[] {
  return parseChangelog(rawChangelog);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderBullet(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
}
