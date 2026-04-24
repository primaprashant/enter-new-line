import { describe, expect, it } from 'vitest';

import { parseChangelog, renderBullet } from './changelog';

describe('parseChangelog', () => {
  it('reads a single entry with named groups and bullets', () => {
    const raw = `# Changelog

## [1.0.0] - 2026-01-01

### Added

- First bullet
- Second bullet

### Fixed

- Tiny fix`;

    const entries = parseChangelog(raw);
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.title).toBe('1.0.0 — 2026-01-01');
    expect(entry.groups).toEqual([
      { kind: 'Added', items: ['First bullet', 'Second bullet'] },
      { kind: 'Fixed', items: ['Tiny fix'] },
    ]);
  });

  it('falls back to a bare version title when no date is present', () => {
    const entries = parseChangelog(`## [Unreleased]

### Added

- Foo`);
    expect(entries[0]?.title).toBe('Unreleased');
  });

  it('places leading bullets without a group into an empty-kind group', () => {
    const entries = parseChangelog(`## [1.0.0] - 2026-01-01

- Loose bullet`);
    expect(entries[0]?.groups).toEqual([{ kind: '', items: ['Loose bullet'] }]);
  });

  it('appends indented continuation lines to the previous bullet', () => {
    const entries = parseChangelog(`## [1.0.0] - 2026-01-01

### Added

- First bullet
  with a continuation
- Second bullet`);
    expect(entries[0]?.groups[0]?.items).toEqual([
      'First bullet with a continuation',
      'Second bullet',
    ]);
  });

  it('returns an empty list when no entries exist', () => {
    expect(parseChangelog('# Changelog\n\nintro paragraph')).toEqual([]);
  });

  it('ignores ### headings before any ## entry', () => {
    expect(parseChangelog(`### Floating\n- Stray`)).toEqual([]);
  });
});

describe('renderBullet', () => {
  it('escapes HTML', () => {
    expect(renderBullet('a < b & c > d "e"')).toBe('a &lt; b &amp; c &gt; d &quot;e&quot;');
  });

  it('promotes inline `code` after escaping', () => {
    expect(renderBullet('use `<div>` carefully')).toBe('use <code>&lt;div&gt;</code> carefully');
  });
});
