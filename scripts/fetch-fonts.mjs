#!/usr/bin/env node
/**
 * Download the latin subset for the bundled UI fonts into public/fonts/.
 * Files are deduped by source URL because Google Fonts often serves one
 * variable .woff2 for multiple weights.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'fonts');

// Request woff2 URLs instead of older formats.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CSS_URL =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=EB+Garamond:ital,wght@0,400;0,500;1,400',
    'family=DM+Sans:wght@400;500;700',
    'family=JetBrains+Mono:wght@400;500',
  ].join('&') +
  '&display=swap';

// Variable fonts usually collapse to one file per family/style pair.
function canonicalName(family, style) {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  return style === 'italic' ? `${slug}-italic.woff2` : `${slug}.woff2`;
}

// Parse the latin @font-face blocks from the stylesheet response.
function parseLatinFaces(css) {
  const faces = [];
  const blockRe = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  let match;
  while ((match = blockRe.exec(css)) !== null) {
    const subset = match[1];
    if (subset !== 'latin') continue;
    const body = match[2];
    const family = /font-family:\s*'([^']+)'/.exec(body)?.[1];
    const style = /font-style:\s*(\w+)/.exec(body)?.[1] ?? 'normal';
    const weight = /font-weight:\s*(\d+)/.exec(body)?.[1];
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    if (!family || !weight || !url) continue;
    faces.push({ family, weight, style, url });
  }
  return faces;
}

async function download(url, destPath) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(destPath));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.warn(`Fetching font CSS from Google Fonts…`);
  const cssRes = await fetch(CSS_URL, { headers: { 'User-Agent': UA } });
  if (!cssRes.ok) throw new Error(`CSS fetch failed: HTTP ${cssRes.status}`);
  const css = await cssRes.text();

  const faces = parseLatinFaces(css);
  if (faces.length === 0) {
    throw new Error('No latin @font-face blocks found in CSS response.');
  }

  // Multiple weight slots often share the same variable font file.
  const urlToFilename = new Map();
  const manifest = [];
  for (const face of faces) {
    const filename = canonicalName(face.family, face.style);
    manifest.push({ ...face, filename });
    if (!urlToFilename.has(face.url)) {
      urlToFilename.set(face.url, filename);
    }
  }

  for (const [url, filename] of urlToFilename) {
    const dest = resolve(OUT_DIR, filename);
    process.stdout.write(`  ${filename} … `);
    await download(url, dest);
    console.warn('ok');
  }

  // Record the resolved face-to-file mapping for later @font-face wiring.
  const readme = [
    '# Bundled fonts',
    '',
    'Latin subset `.woff2` files for EnterNewLine UI surfaces. Bundled locally',
    'so extension pages can load them under MV3 CSP without remote fetches.',
    '',
    'Regenerate with:',
    '',
    '    npm run fonts:fetch',
    '',
    '## Face → file',
    '',
    '| Family | Weight | Style | File |',
    '|---|---|---|---|',
    ...manifest.map((m) => `| ${m.family} | ${m.weight} | ${m.style} | \`${m.filename}\` |`),
    '',
    'Google Fonts serves variable fonts where available, so a single file may',
    'cover multiple weights — `@font-face` declarations in `src/styles/` should',
    'use a weight range (e.g. `font-weight: 400 700`) against the same file.',
    '',
  ].join('\n');
  await writeFile(resolve(OUT_DIR, 'README.md'), readme);

  console.warn(
    `\nDone. ${urlToFilename.size} unique file(s), covering ${manifest.length} face(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
