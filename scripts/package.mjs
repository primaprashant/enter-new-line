#!/usr/bin/env node
/**
 * Pack dist/{target}/ into a store-ready archive under release/.
 * Requires the system `zip` binary.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGETS = ['chrome', 'firefox'];
const target = process.argv[2];
if (!target || !TARGETS.includes(target)) {
  console.error(`usage: package.mjs <${TARGETS.join('|')}>`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const distDir = join(root, 'dist', target);
if (!existsSync(distDir)) {
  console.error(`dist/${target} does not exist. Run \`npm run build:${target}\` first.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const releaseDir = join(root, 'release');
mkdirSync(releaseDir, { recursive: true });

const ext = target === 'firefox' ? 'xpi' : 'zip';
const outPath = join(releaseDir, `enter-new-line-${pkg.version}-${target}.${ext}`);
rmSync(outPath, { force: true });

const packageDir = mkdtempSync(join(tmpdir(), `enter-new-line-${target}-`));
cpSync(distDir, packageDir, { recursive: true });

const manifestPath = join(packageDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.web_accessible_resources = manifest.web_accessible_resources
  ?.map((entry) => ({
    ...entry,
    resources: entry.resources?.filter((resource) => !resource.endsWith('.map')),
  }))
  .filter((entry) => entry.resources?.length);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const result = spawnSync(
  'zip',
  ['-r', '-9', '-q', outPath, '.', '-x', '*.map', 'fonts/README.md'],
  { cwd: packageDir, stdio: 'inherit' },
);
rmSync(packageDir, { force: true, recursive: true });
if (result.error) {
  console.error(`failed to invoke zip: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`zip exited with status ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log(`wrote ${outPath}`);
