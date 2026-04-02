import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  install404Fetch,
  installFetchFromRepoSource,
  withTempProject,
} from './test-helpers.mjs';

async function testSuccessPath(copyComponent) {
  const restoreFetch = installFetchFromRepoSource();

  try {
    await withTempProject('copier-success', async (targetDir) => {
      const result = await copyComponent('badge', {
        targetDir,
        platform: 'react',
      });

      assert.equal(result.success, true, 'badge copy should succeed');
      assert.deepEqual(result.errors, []);
      assert.deepEqual(result.skipped, []);
      assert.deepEqual(result.filesCopied.sort(), [
        'src/components/badge/Badge.tsx',
        'src/components/badge/index.ts',
        'src/components/badge/variants.ts',
      ]);

      const badgeDir = path.join(targetDir, 'src', 'components', 'badge');
      const copiedFiles = (await readdir(badgeDir)).sort();
      assert.deepEqual(copiedFiles, ['Badge.tsx', 'index.ts', 'variants.ts']);
    });

    console.log('PASS success path');
  } finally {
    restoreFetch();
  }
}

async function testFailureCleanup(copyComponent) {
  const restoreFetch = install404Fetch();

  try {
    await withTempProject('copier-failure', async (targetDir) => {
      const result = await copyComponent('badge', {
        targetDir,
        platform: 'react',
      });

      assert.equal(
        result.success,
        false,
        'badge copy should fail on 404 fetch',
      );
      assert.deepEqual(result.filesCopied, []);
      assert.equal(
        result.errors.length,
        3,
        'badge should report all three missing files',
      );
      assert.match(result.errors[0], /^Badge\.tsx: GitHub fetch error:/);
      assert.match(result.errors[1], /^variants\.ts: GitHub fetch error:/);
      assert.match(result.errors[2], /^index\.ts: GitHub fetch error:/);

      const badgeDir = path.join(targetDir, 'src', 'components', 'badge');
      assert.equal(
        existsSync(badgeDir),
        true,
        'component directory may exist after cleanup',
      );
      assert.deepEqual(
        await readdir(badgeDir),
        [],
        'cleanup should remove partially written files',
      );
    });

    console.log('PASS failure cleanup');
  } finally {
    restoreFetch();
  }
}

async function main() {
  const { copyComponent } = await import('../dist/utils/component-copier.js');

  await testSuccessPath(copyComponent);
  await testFailureCleanup(copyComponent);

  console.log('component-copier regression checks passed');
}

await main();
