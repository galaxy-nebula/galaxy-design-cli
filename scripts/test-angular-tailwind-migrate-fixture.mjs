import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFetchFromRepoSource } from './test-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(workspaceRoot, 'test', 'galaxy-angular-lint');

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
    path.join(os.tmpdir(), 'galaxy-angular-tailwind-migrate-'),
  );

  try {
    await cp(fixtureRoot, tempRoot, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules`),
    });

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
      path.join(tempRoot, 'tailwind.config.js'),
      `module.exports = {
  content: ['./src/**/*.{html,ts}'],
  safelist: ['legacy-panel'],
  separator: ':',
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
    );

    await writeFile(
      path.join(tempRoot, 'src', 'styles.css'),
      `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .legacy-panel {
    box-shadow: none;
  }
}
`,
    );

    const { addCommand } = await import('../dist/commands/add.js');
    await addCommand(['input'], { cwd: tempRoot });

    const { planTailwindMigration } =
      await import('../dist/utils/tailwind-migration.js');
    const { migrateTailwindCommand } =
      await import('../dist/commands/migrate-tailwind.js');

    const dryRunPlan = planTailwindMigration(tempRoot);
    assert.equal(dryRunPlan.framework, 'angular');
    assert.equal(dryRunPlan.detection.version, 3);
    assert.equal(dryRunPlan.cssPath, 'src/styles.css');
    assert.equal(
      dryRunPlan.auditFindings.some(
        (finding) => finding.pattern === '@layer utilities',
      ),
      true,
    );
    assert.equal(
      dryRunPlan.auditFindings.some(
        (finding) => finding.pattern === 'safelist',
      ),
      true,
    );
    assert.equal(
      dryRunPlan.auditFindings.some(
        (finding) => finding.pattern === 'separator',
      ),
      true,
    );

    const stylesBefore = await readFile(
      path.join(tempRoot, 'src', 'styles.css'),
      'utf-8',
    );
    await migrateTailwindCommand({ cwd: tempRoot, dryRun: true, yes: true });
    const stylesAfterDryRun = await readFile(
      path.join(tempRoot, 'src', 'styles.css'),
      'utf-8',
    );
    assert.equal(stylesAfterDryRun, stylesBefore);

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

    const migratedStyles = await readFile(
      path.join(tempRoot, 'src', 'styles.css'),
      'utf-8',
    );
    assert.match(migratedStyles, /@import "tailwindcss";/);
    assert.match(migratedStyles, /@layer utilities/);
    assert.doesNotMatch(migratedStyles, /@tailwind base;/);

    const migratedPostcss = await readFile(
      path.join(tempRoot, 'postcss.config.js'),
      'utf-8',
    );
    assert.match(migratedPostcss, /"@tailwindcss\/postcss"/);
    assert.doesNotMatch(migratedPostcss, /autoprefixer/);

    const componentsConfig = JSON.parse(
      await readFile(path.join(tempRoot, 'components.json'), 'utf-8'),
    );
    assert.equal(componentsConfig.tailwind.version, 4);

    run('npm', ['install'], tempRoot);
    run('npm', ['run', 'build'], tempRoot);

    console.log('PASS angular tailwind migrate fixture');
  } finally {
    restoreFetch();
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
