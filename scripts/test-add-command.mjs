import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  install404Fetch,
  installFetchFromRepoSource,
  withTempProject,
} from './test-helpers.mjs';

function createComponentsConfig(framework = 'react') {
  return {
    $schema: 'https://galaxy-nebula.vercel.app/schema.json',
    framework,
    typescript: true,
    tailwind: {
      config: 'tailwind.config.js',
      css: 'src/index.css',
      baseColor: 'slate',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
      lib: '@/lib',
    },
    iconLibrary: 'lucide',
  };
}

async function setupReactProject(projectRoot) {
  await writeFile(
    path.join(projectRoot, 'components.json'),
    JSON.stringify(createComponentsConfig(), null, 2),
  );
}

async function setupNextjsProject(projectRoot) {
  await writeFile(
    path.join(projectRoot, 'components.json'),
    JSON.stringify(createComponentsConfig('nextjs'), null, 2),
  );
}

async function setupNuxtProject(projectRoot) {
  await writeFile(
    path.join(projectRoot, 'components.json'),
    JSON.stringify(createComponentsConfig('nuxtjs'), null, 2),
  );
}

async function testSuccessPath(addCommand) {
  const restoreFetch = installFetchFromRepoSource();

  try {
    await withTempProject('add-success', async (targetDir) => {
      await setupReactProject(targetDir);
      await addCommand(['input'], { cwd: targetDir });

      const inputDir = path.join(targetDir, 'src', 'components', 'ui', 'input');
      const copiedFiles = (await readdir(inputDir)).sort();

      assert.deepEqual(copiedFiles, ['Input.tsx', 'index.ts']);
      assert.equal(existsSync(path.join(inputDir, 'Input.tsx')), true);
      assert.equal(existsSync(path.join(inputDir, 'index.ts')), true);
    });

    console.log('PASS add success path');
  } finally {
    restoreFetch();
  }
}

async function testFailureCleanup(addCommand) {
  const restoreFetch = install404Fetch();

  try {
    await withTempProject('add-failure', async (targetDir) => {
      await setupReactProject(targetDir);
      await addCommand(['input'], { cwd: targetDir });
      assert.equal(
        process.exitCode,
        1,
        'failed add should set a non-zero exit code',
      );
      process.exitCode = undefined;

      const inputDir = path.join(targetDir, 'src', 'components', 'ui', 'input');
      assert.equal(
        existsSync(inputDir),
        true,
        'component directory may exist after failed add',
      );
      assert.deepEqual(
        await readdir(inputDir),
        [],
        'failed add should not leave partial files',
      );
    });

    console.log('PASS add failure cleanup');
  } finally {
    restoreFetch();
  }
}

async function testNextjsDirectivePlacement(addCommand) {
  const restoreFetch = installFetchFromRepoSource();

  try {
    await withTempProject('add-nextjs-directive', async (targetDir) => {
      await setupNextjsProject(targetDir);
      await addCommand(['badge'], { cwd: targetDir });

      const badgeFile = path.join(
        targetDir,
        'src',
        'components',
        'ui',
        'badge',
        'Badge.tsx',
      );
      const badgeVariantsFile = path.join(
        targetDir,
        'src',
        'components',
        'ui',
        'badge',
        'variants.ts',
      );
      const badgeContent = readFileSync(badgeFile, 'utf-8');

      assert.equal(
        existsSync(badgeVariantsFile),
        true,
        'nextjs add should copy badge sidecar files such as variants.ts',
      );

      assert.match(
        badgeContent,
        /^\/\*\*[\s\S]*?\*\/\n\n'use client'\n\nimport /,
        'use client should be inserted after the leading block comment',
      );
      assert.equal(
        badgeContent.includes("/**\n'use client'"),
        false,
        'use client must not be inserted inside a block comment',
      );
    });

    console.log('PASS add nextjs directive placement');
  } finally {
    restoreFetch();
  }
}

async function testNuxtDoesNotInjectNextDirective(addCommand) {
  const restoreFetch = installFetchFromRepoSource();

  try {
    await withTempProject('add-nuxt-no-directive', async (targetDir) => {
      await setupNuxtProject(targetDir);
      await addCommand(['input'], { cwd: targetDir });

      const inputFile = path.join(
        targetDir,
        'src',
        'components',
        'ui',
        'input',
        'Input.vue',
      );
      const inputContent = readFileSync(inputFile, 'utf-8');

      assert.equal(
        inputContent.includes("'use client'") ||
          inputContent.includes('"use client"'),
        false,
        'Nuxt/Vue component should not receive a Next.js client directive',
      );
      assert.match(
        inputContent,
        /^<!--[\s\S]*?-->\n<script setup lang="ts">/,
        'leading Vue comment and script setup block should remain intact',
      );
    });

    console.log('PASS add nuxt no nextjs directive');
  } finally {
    restoreFetch();
  }
}

async function main() {
  const { addCommand } = await import('../dist/commands/add.js');

  await testSuccessPath(addCommand);
  await testFailureCleanup(addCommand);
  await testNextjsDirectivePlacement(addCommand);
  await testNuxtDoesNotInjectNextDirective(addCommand);

  console.log('add command regression checks passed');
}

await main();
