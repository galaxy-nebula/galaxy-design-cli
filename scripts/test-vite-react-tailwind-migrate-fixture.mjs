import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(workspaceRoot, 'test', 'galaxy-vite-react-lint');

if (!existsSync(fixtureRoot)) {
  // FIXTURE-SKIP: fixture dirs are not part of the repo; skip when absent.
  console.log(`SKIP galaxy-vite-react-lint (fixture not found)`);
  process.exit(0);
}


function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n'));
  }
}

async function main() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'galaxy-vite-react-tailwind-migrate-'),
  );

  try {
    await cp(fixtureRoot, tempRoot, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules`),
    });
    await writeFile(
      path.join(tempRoot, 'src', 'components', 'ui', 'toggle', 'index.ts'),
      "export { Toggle } from './Toggle'\nexport { toggleVariants } from './variants'\n",
    );

    const packageJson = JSON.parse(
      await readFile(path.join(tempRoot, 'package.json'), 'utf-8'),
    );
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      tailwindcss: '^3.4.17',
      autoprefixer: '^10.4.20',
      postcss: '^8.4.49',
    };
    await writeFile(
      path.join(tempRoot, 'package.json'),
      `${JSON.stringify(packageJson, null, 2)}\n`,
    );

    await writeFile(
      path.join(tempRoot, 'postcss.config.js'),
      `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    );

    await writeFile(
      path.join(tempRoot, 'tailwind.config.ts'),
      `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,
    );

    const originalCss = await readFile(
      path.join(tempRoot, 'src', 'index.css'),
      'utf-8',
    );
    await writeFile(
      path.join(tempRoot, 'src', 'index.css'),
      `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .legacy-panel {
    box-shadow: var(--shadow);
  }
}

${originalCss}`,
    );

    const { planTailwindMigration } =
      await import('../dist/utils/tailwind-migration.js');
    const { migrateTailwindCommand } =
      await import('../dist/commands/migrate-tailwind.js');

    const dryRunPlan = planTailwindMigration(tempRoot);
    assert.equal(dryRunPlan.framework, 'react');
    assert.equal(dryRunPlan.detection.version, 3);
    assert.equal(dryRunPlan.cssPath, 'src/index.css');
    assert.equal(
      dryRunPlan.auditFindings.some(
        (finding) => finding.pattern === '@layer utilities',
      ),
      true,
    );
    assert.equal(
      dryRunPlan.auditFindings.some(
        (finding) => finding.pattern === 'corePlugins',
      ),
      true,
    );

    const cssBefore = await readFile(
      path.join(tempRoot, 'src', 'index.css'),
      'utf-8',
    );
    await migrateTailwindCommand({ cwd: tempRoot, dryRun: true, yes: true });
    const cssAfterDryRun = await readFile(
      path.join(tempRoot, 'src', 'index.css'),
      'utf-8',
    );
    assert.equal(cssAfterDryRun, cssBefore);

    await migrateTailwindCommand({ cwd: tempRoot, yes: true });

    const migratedPackageJson = JSON.parse(
      await readFile(path.join(tempRoot, 'package.json'), 'utf-8'),
    );
    assert.match(migratedPackageJson.devDependencies.tailwindcss, /^\^4\./);
    assert.match(
      migratedPackageJson.devDependencies['@tailwindcss/postcss'],
      /^\^4\./,
    );
    assert.equal('autoprefixer' in migratedPackageJson.devDependencies, false);

    const migratedCss = await readFile(
      path.join(tempRoot, 'src', 'index.css'),
      'utf-8',
    );
    assert.match(migratedCss, /@import "tailwindcss";/);
    assert.match(migratedCss, /@import "tw-animate-css";/);
    assert.match(migratedCss, /@theme inline/);
    assert.match(migratedCss, /--color-border: hsl\(var\(--border\)\)/);
    assert.match(migratedCss, /@layer utilities/);
    assert.doesNotMatch(migratedCss, /@tailwind base;/);

    const migratedPostcss = await readFile(
      path.join(tempRoot, 'postcss.config.js'),
      'utf-8',
    );
    assert.match(migratedPostcss, /"@tailwindcss\/postcss"/);
    assert.match(migratedPostcss, /export default/);
    assert.doesNotMatch(migratedPostcss, /module\.exports/);
    assert.doesNotMatch(migratedPostcss, /autoprefixer/);

    const componentsConfig = JSON.parse(
      await readFile(path.join(tempRoot, 'components.json'), 'utf-8'),
    );
    assert.equal(componentsConfig.tailwind.version, 4);

    run('npm', ['run', 'build'], tempRoot);

    console.log('PASS vite react tailwind migrate fixture');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
