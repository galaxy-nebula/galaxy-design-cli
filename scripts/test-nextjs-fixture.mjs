import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFetchFromRepoSource } from './test-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(workspaceRoot, 'test', 'galaxy-nextjs-lint');

if (!existsSync(fixtureRoot)) {
  // FIXTURE-SKIP: fixture dirs are not part of the repo; skip when absent.
  console.log(`SKIP galaxy-nextjs-lint (fixture not found)`);
  process.exit(0);
}


async function main() {
  const restoreFetch = installFetchFromRepoSource();
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'galaxy-nextjs-fixture-'),
  );

  try {
    await cp(fixtureRoot, tempRoot, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules`),
    });

    const badgeDir = path.join(tempRoot, 'src', 'components', 'ui', 'badge');
    if (existsSync(badgeDir)) {
      await rm(badgeDir, { recursive: true, force: true });
    }

    const { addCommand } = await import('../dist/commands/add.js');
    await addCommand(['badge'], { cwd: tempRoot });

    const badgeFile = path.join(
      tempRoot,
      'src',
      'components',
      'ui',
      'badge',
      'Badge.tsx',
    );
    const badgeFiles = (await readdir(badgeDir)).sort();
    const badgeContent = await readFile(badgeFile, 'utf-8');

    assert.deepEqual(
      badgeFiles,
      ['Badge.tsx', 'index.ts', 'variants.ts'],
      'nextjs fixture should copy all badge source files, including sidecar variants.ts',
    );

    assert.match(
      badgeContent,
      /^\/\*\*[\s\S]*?\*\/\n\n'use client'\n\nimport /,
      'nextjs fixture should keep comment header and insert use client before imports',
    );
    assert.equal(
      badgeContent.includes("/**\n'use client'"),
      false,
      'use client must not be inserted inside the opening block comment',
    );

    console.log('PASS nextjs fixture directive placement');
  } finally {
    restoreFetch();
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
