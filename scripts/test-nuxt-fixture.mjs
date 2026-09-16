import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFetchFromRepoSource } from './test-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(workspaceRoot, 'test', 'galaxy-nuxt-lint');

if (!existsSync(fixtureRoot)) {
  // FIXTURE-SKIP: fixture dirs are not part of the repo; skip when absent.
  console.log(`SKIP galaxy-nuxt-lint (fixture not found)`);
  process.exit(0);
}


async function main() {
  const restoreFetch = installFetchFromRepoSource();
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'galaxy-nuxt-fixture-'),
  );

  try {
    await cp(fixtureRoot, tempRoot, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules`),
    });
    // The fixture intentionally omits installed dependencies; use the CLI's
    // declared Bun package manager instead of exercising an npm/Nuxt resolver bug.
    await writeFile(path.join(tempRoot, 'bun.lock'), '');

    const inputDir = path.join(tempRoot, 'components', 'ui', 'input');
    if (existsSync(inputDir)) {
      await rm(inputDir, { recursive: true, force: true });
    }

    const { addCommand } = await import('../dist/commands/add.js');
    await addCommand(['input'], { cwd: tempRoot });

    const inputFile = path.join(
      tempRoot,
      'components',
      'ui',
      'input',
      'Input.vue',
    );
    const inputContent = await readFile(inputFile, 'utf-8');

    assert.match(
      inputContent,
      /^<!--[\s\S]*?-->\n<script setup lang="ts">/,
      'nuxt fixture should preserve the leading Vue comment and script setup block',
    );
    assert.equal(
      inputContent.includes("'use client'") ||
        inputContent.includes('"use client"'),
      false,
      'Nuxt fixture must not inject a Next.js client directive',
    );

    console.log('PASS nuxt fixture component transform');
  } finally {
    restoreFetch();
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
