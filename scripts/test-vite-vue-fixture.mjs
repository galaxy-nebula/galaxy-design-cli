import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { installFetchFromRepoSource } from './test-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(workspaceRoot, 'test', 'galaxy-vite-vue-lint');

if (!existsSync(fixtureRoot)) {
  // FIXTURE-SKIP: fixture dirs are not part of the repo; skip when absent.
  console.log(`SKIP galaxy-vite-vue-lint (fixture not found)`);
  process.exit(0);
}


function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(
      output ||
        `${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`,
    );
  }
}

async function main() {
  const restoreFetch = installFetchFromRepoSource();
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'galaxy-vite-vue-fixture-'),
  );

  try {
    await cp(fixtureRoot, tempRoot, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules`),
    });

    const inputDir = path.join(tempRoot, 'src', 'components', 'ui', 'input');
    if (existsSync(inputDir)) {
      await rm(inputDir, { recursive: true, force: true });
    }

    const { addCommand } = await import('../dist/commands/add.js');
    await addCommand(['input'], { cwd: tempRoot });

    const inputFile = path.join(
      tempRoot,
      'src',
      'components',
      'ui',
      'input',
      'Input.vue',
    );
    const inputContent = await readFile(inputFile, 'utf-8');

    assert.match(
      inputContent,
      /^<!--[\s\S]*?-->\n<script setup lang="ts">/,
      'vite vue fixture should preserve the leading Vue comment and script setup block',
    );
    assert.match(
      inputContent,
      /from '@\/lib\/utils'/,
      'vite vue fixture should keep the generated @/lib/utils import',
    );

    run('npm', ['install'], tempRoot);
    run('npm', ['run', 'build'], tempRoot);

    console.log('PASS vite vue fixture add/build');
  } finally {
    restoreFetch();
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
