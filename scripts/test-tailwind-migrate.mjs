import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withTempProject } from './test-helpers.mjs';

async function testTailwindMigrationPlanAndApply() {
  const migration = await import('../dist/utils/tailwind-migration.js');

  await withTempProject('tailwind-migrate-react', async (targetDir) => {
    await writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify(
        {
          name: 'tailwind-migrate-react',
          devDependencies: {
            tailwindcss: '^3.4.3',
            autoprefixer: '^10.4.20',
            postcss: '^8.4.49',
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(targetDir, 'components.json'),
      JSON.stringify(
        {
          framework: 'react',
          typescript: true,
          tailwind: {
            version: 3,
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
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(targetDir, 'postcss.config.js'),
      `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    );
    await writeFile(
      path.join(targetDir, 'src', 'index.css'),
      `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .legacy-focus-ring {
    outline: none;
  }
}

body {
  color: black;
}
`,
    );
    await writeFile(
      path.join(targetDir, 'tailwind.config.js'),
      `module.exports = {
  corePlugins: {
    preflight: false,
  },
  safelist: ['legacy-focus-ring'],
  separator: ':',
};
`,
    );
    await writeFile(
      path.join(targetDir, 'src', 'App.tsx'),
      `export function App() {
  return <div className="outline-none ring bg-opacity-50 text-opacity-80">test</div>;
}
`,
    );

    const plan = migration.planTailwindMigration(targetDir);
    assert.equal(plan.detection.version, 3);
    assert.equal(plan.cssPath, 'src/index.css');
    assert.equal(plan.postcssConfigPath, 'postcss.config.js');
    assert.equal(
      plan.addedDevDependencies.includes('tailwindcss@^4.1.16'),
      true,
    );
    assert.equal(
      plan.addedDevDependencies.includes('@tailwindcss/postcss@^4.1.16'),
      true,
    );
    assert.equal(plan.removedPackages.includes('autoprefixer'), true);
    assert.equal(plan.auditFindings.length >= 6, true);
    assert.equal(
      plan.auditFindings.some(
        (finding) => finding.pattern === '@layer utilities',
      ),
      true,
    );
    assert.equal(
      plan.auditFindings.some((finding) => finding.pattern === 'corePlugins'),
      true,
    );
    assert.equal(
      plan.auditFindings.some((finding) => finding.pattern === 'safelist'),
      true,
    );
    assert.equal(
      plan.auditFindings.some((finding) => finding.pattern === 'separator'),
      true,
    );
    assert.equal(
      plan.notes.some((note) => note.includes('legacy JS config options')),
      true,
    );

    const result = migration.applyTailwindMigration(targetDir);
    assert.equal(result.componentsConfigUpdated, true);

    const packageJson = JSON.parse(
      readFileSync(path.join(targetDir, 'package.json'), 'utf-8'),
    );
    assert.equal(packageJson.devDependencies.tailwindcss, '^4.1.16');
    assert.equal(
      packageJson.devDependencies['@tailwindcss/postcss'],
      '^4.1.16',
    );
    assert.equal('autoprefixer' in packageJson.devDependencies, false);

    assert.match(
      readFileSync(path.join(targetDir, 'postcss.config.js'), 'utf-8'),
      /"@tailwindcss\/postcss"/,
    );
    assert.doesNotMatch(
      readFileSync(path.join(targetDir, 'postcss.config.js'), 'utf-8'),
      /autoprefixer/,
    );
    assert.match(
      readFileSync(path.join(targetDir, 'src', 'index.css'), 'utf-8'),
      /@import "tailwindcss";/,
    );
    assert.doesNotMatch(
      readFileSync(path.join(targetDir, 'src', 'index.css'), 'utf-8'),
      /@tailwind base;/,
    );

    const componentsConfig = JSON.parse(
      readFileSync(path.join(targetDir, 'components.json'), 'utf-8'),
    );
    assert.equal(componentsConfig.tailwind.version, 4);
  });

  await withTempProject('tailwind-migrate-v4-noop', async (targetDir) => {
    await writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify(
        {
          type: 'module',
          dependencies: {
            react: '^19.0.0',
          },
          devDependencies: {
            tailwindcss: '^4.1.16',
            '@tailwindcss/postcss': '^4.1.16',
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(targetDir, 'src', 'index.css'),
      '@import "tailwindcss";\n',
    );

    const plan = migration.planTailwindMigration(targetDir);
    assert.equal(plan.detection.version, 4);
    assert.equal(
      plan.notes[0].includes('already appears to use Tailwind v4'),
      true,
    );
  });

  console.log('PASS tailwind migrate');
}

await testTailwindMigrationPlanAndApply();
