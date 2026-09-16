#!/usr/bin/env node
/**
 * Release-time script: fetch the latest registry manifest from the CDN,
 * update the bundled EXPECTED_REGISTRY_DIGEST in registry-fetcher.ts.
 * Run after `npm run manifests:build:artifact` in galaxy-design + deploy.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);
const fetcherPath = resolve(
  projectRoot,
  'src/utils/registry-fetcher.ts',
);

const registryUrl =
  process.env.GALAXY_REGISTRY_URL ||
  'https://galaxy-design.vercel.app/registry';

const manifest = await (async () => {
  const response = await fetch(`${registryUrl}/latest-manifest.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
  }
  return response.json();
})();

console.log(`Registry version: ${manifest.version}`);
console.log(`Digest: ${manifest.digest}`);
console.log(`Sources: ${manifest.sourcesCount}`);

const content = readFileSync(fetcherPath, 'utf-8');
const updated = content.replace(
  /export const EXPECTED_REGISTRY_DIGEST =\s*\n\s*'([^']+)';/,
  `export const EXPECTED_REGISTRY_DIGEST =\n  '${manifest.digest}';`,
);

if (updated === content) {
  console.log('Digest already up to date.');
} else {
  writeFileSync(fetcherPath, updated);
  console.log('Updated EXPECTED_REGISTRY_DIGEST in registry-fetcher.ts');
}
