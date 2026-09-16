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
  const {
    getTailwindDevDependencies,
    getTailwindMergeDependency,
    scaffoldTailwindFiles,
  } =
    await import('../dist/utils/tailwind-scaffold.js');
  const { compile } = await import('tailwindcss');

  assert.deepEqual(getTailwindDevDependencies('v4'), [
    'tailwindcss',
    '@tailwindcss/postcss',
    'tw-animate-css',
  ]);
  assert.equal(getTailwindMergeDependency('v4'), 'tailwind-merge@^3.3.1');
  assert.equal(getTailwindMergeDependency('v3'), 'tailwind-merge@^2.6.0');

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
    const css = readFileSync(
      path.join(targetDir, 'app', 'globals.css'),
      'utf-8',
    );
    assert.match(css, /@import "tailwindcss"/);
    assert.match(css, /@import "tw-animate-css"/);
    assert.match(css, /@custom-variant dark/);
    assert.match(css, /@theme inline/);
    assert.match(css, /--color-border: hsl\(var\(--border\)\)/);
    assert.match(css, /--color-background: hsl\(var\(--background\)\)/);

    const compilableCss = css
      .replace('@import "tailwindcss";', '@tailwind utilities;')
      .replace('@import "tw-animate-css";', '');
    const compiler = await compile(compilableCss);
    const output = compiler.build([
      'border-border',
      'bg-background',
      'text-foreground',
      'rounded-lg',
      'dark:bg-background',
    ]);
    assert.match(output, /\.border-border/);
    assert.match(output, /\.bg-background/);
    assert.match(output, /\.text-foreground/);
    assert.match(output, /\.rounded-lg/);
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
    assert.match(
      readFileSync(path.join(targetDir, 'tailwind.config.js'), 'utf-8'),
      /tailwindcss-animate/,
    );
    assert.equal(
      getTailwindDevDependencies('v3').includes(
        'tailwindcss-animate@^1.0.7',
      ),
      true,
    );
  });

  console.log('PASS tailwind scaffold');
}

await testTailwindDetection();
await testTailwindScaffold();

console.log('tailwind utility checks passed');
