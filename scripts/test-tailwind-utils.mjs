import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withTempProject } from './test-helpers.mjs';

async function testTailwindDetection() {
  const { detectTailwindVersion, resolveTailwindMode } =
    await import('../dist/utils/tailwind-detector.js');

  await withTempProject('tailwind-detect-v4', async (targetDir) => {
    await writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify(
        {
          devDependencies: {
            tailwindcss: '^4.1.16',
            '@tailwindcss/postcss': '^4.1.16',
          },
        },
        null,
        2,
      ),
    );

    const result = detectTailwindVersion(targetDir);
    assert.equal(result.version, 4);
    assert.equal(result.source, 'package-json');
    assert.equal(resolveTailwindMode(result), 'v4');
  });

  await withTempProject('tailwind-detect-v3', async (targetDir) => {
    await writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify(
        {
          devDependencies: {
            tailwindcss: '^3.4.3',
          },
        },
        null,
        2,
      ),
    );

    const result = detectTailwindVersion(targetDir);
    assert.equal(result.version, 3);
    assert.equal(result.source, 'package-json');
    assert.equal(resolveTailwindMode(result), 'v3');
  });

  console.log('PASS tailwind detection');
}

async function testTailwindScaffold() {
  const { scaffoldTailwindFiles } =
    await import('../dist/utils/tailwind-scaffold.js');

  await withTempProject('tailwind-scaffold-v4', async (targetDir) => {
    const result = scaffoldTailwindFiles({
      cwd: targetDir,
      framework: 'nextjs',
      mode: 'v4',
      configPath: '',
      cssPath: 'app/globals.css',
      baseColor: 'slate',
    });

    assert.ok(result.written.includes('postcss.config.mjs'));
    assert.ok(result.written.includes('app/globals.css'));
    assert.equal(existsSync(path.join(targetDir, 'tailwind.config.ts')), false);
    assert.match(
      readFileSync(path.join(targetDir, 'app', 'globals.css'), 'utf-8'),
      /@import "tailwindcss"/,
    );
  });

  await withTempProject('tailwind-scaffold-v3', async (targetDir) => {
    const result = scaffoldTailwindFiles({
      cwd: targetDir,
      framework: 'react',
      mode: 'v3',
      configPath: 'tailwind.config.js',
      cssPath: 'src/index.css',
      baseColor: 'slate',
    });

    assert.ok(result.written.includes('postcss.config.js'));
    assert.ok(result.written.includes('tailwind.config.js'));
    assert.ok(result.written.includes('src/index.css'));
    assert.match(
      readFileSync(path.join(targetDir, 'src', 'index.css'), 'utf-8'),
      /@tailwind base;/,
    );
  });

  console.log('PASS tailwind scaffold');
}

await testTailwindDetection();
await testTailwindScaffold();

console.log('tailwind utility checks passed');
