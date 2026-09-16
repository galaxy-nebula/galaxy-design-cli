import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'galaxy-nextjs-tailwind-migrate-'),
  );

  try {
    await cp(fixtureRoot, tempRoot, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules`),
    });

    await writeFile(
      path.join(tempRoot, 'src', 'app', 'globals.css'),
      `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .legacy-focus-ring {
    outline: none;
  }
}
`,
    );

    await writeFile(
      path.join(tempRoot, 'tailwind.config.ts'),
      `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: ['legacy-focus-ring'],
  separator: ':',
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,
    );

    const { planTailwindMigration } =
      await import('../dist/utils/tailwind-migration.js');
    const { migrateTailwindCommand } =
      await import('../dist/commands/migrate-tailwind.js');

    const dryRunPlan = planTailwindMigration(tempRoot);
    assert.equal(dryRunPlan.framework, 'nextjs');
    assert.equal(dryRunPlan.detection.version, 3);
    assert.equal(dryRunPlan.cssPath, 'src/app/globals.css');
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

    const globalsBefore = await readFile(
      path.join(tempRoot, 'src', 'app', 'globals.css'),
      'utf-8',
    );
    await migrateTailwindCommand({ cwd: tempRoot, dryRun: true, yes: true });
    const globalsAfterDryRun = await readFile(
      path.join(tempRoot, 'src', 'app', 'globals.css'),
      'utf-8',
    );
    assert.equal(
      globalsAfterDryRun,
      globalsBefore,
      'dry-run should not modify Next.js fixture files',
    );

    await migrateTailwindCommand({ cwd: tempRoot, yes: true });

    const packageJson = JSON.parse(
      await readFile(path.join(tempRoot, 'package.json'), 'utf-8'),
    );
    assert.match(packageJson.devDependencies.tailwindcss, /^\^4\./);
    assert.match(packageJson.devDependencies['@tailwindcss/postcss'], /^\^4\./);
    assert.equal('autoprefixer' in packageJson.devDependencies, false);

    const globalsAfter = await readFile(
      path.join(tempRoot, 'src', 'app', 'globals.css'),
      'utf-8',
    );
    assert.match(globalsAfter, /@import "tailwindcss";/);
    assert.match(globalsAfter, /@import "tw-animate-css";/);
    assert.match(globalsAfter, /@theme inline/);
    assert.match(globalsAfter, /--color-border: hsl\(var\(--border\)\)/);
    assert.match(globalsAfter, /@config "\.\.\/\.\.\/tailwind\.config\.ts";/);
    assert.doesNotMatch(globalsAfter, /@tailwind base;/);
    assert.match(globalsAfter, /@layer utilities/);

    const postcssAfter = await readFile(
      path.join(tempRoot, 'postcss.config.js'),
      'utf-8',
    );
    assert.match(postcssAfter, /"@tailwindcss\/postcss"/);
    assert.doesNotMatch(postcssAfter, /autoprefixer/);

    const componentsConfig = JSON.parse(
      await readFile(path.join(tempRoot, 'components.json'), 'utf-8'),
    );
    assert.equal(componentsConfig.tailwind.version, 4);

    console.log('PASS nextjs tailwind migrate fixture');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
