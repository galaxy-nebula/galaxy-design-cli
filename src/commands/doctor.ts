import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import {
  loadComponentsConfig,
  hasComponentsConfig,
} from '../utils/components-config.js';
import {
  validateConfig,
  type ComponentsConfig,
} from '../utils/config-schema.js';
import {
  detectFramework,
  detectPackageManager,
  hasSrcDirectory,
} from '../utils/detect.js';
import { detectTailwindVersion } from '../utils/tailwind-detector.js';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface CheckResult {
  status: CheckStatus;
  message: string;
  hint?: string;
}

interface DoctorOptions {
  cwd: string;
}

export async function doctorCommand(options: DoctorOptions) {
  const cwd = options.cwd;
  const checks: CheckStatus[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const passed: string[] = [];

  const report = (status: CheckStatus, message: string, hint?: string) => {
    checks.push(status);
    if (status === 'pass') {
      passed.push(message);
      console.log(chalk.green('✓'), message);
    } else if (status === 'warn') {
      warnings.push(message);
      console.log(chalk.yellow('⚠'), message);
    } else {
      failures.push(hint ? `${message} — ${hint}` : message);
      console.log(chalk.red('✗'), message);
      if (hint) {
        console.log(chalk.gray(`  ${hint}`));
      }
    }
  };

  console.log(chalk.bold.cyan('\n🌌 Galaxy UI Doctor\n'));

  // 1. components.json
  if (!hasComponentsConfig(cwd)) {
    report(
      'fail',
      'components.json not found',
      'Run `galaxy-design init` first.',
    );
    printSummary(checks, warnings, failures, passed);
    return;
  }

  let config: ComponentsConfig | null = null;
  try {
    const raw = JSON.parse(readFileSync(join(cwd, 'components.json'), 'utf-8'));
    config = validateConfig(raw);
    report('pass', `components.json valid (framework: ${config.framework})`);
  } catch (error) {
    report(
      'fail',
      'components.json is invalid',
      error instanceof Error ? error.message : String(error),
    );
    printSummary(checks, warnings, failures, passed);
    return;
  }

  const framework = config.framework;

  // 2. framework detection consistency
  const detected = detectFramework(cwd);
  if (detected === framework) {
    report('pass', `Framework detection matches config (${framework})`);
  } else {
    report(
      'warn',
      `Framework mismatch: config=${framework}, detected=${detected}`,
    );
  }

  // 3. tailwind checks (skip for flutter)
  if (framework === 'flutter') {
    report('pass', 'Flutter project — Tailwind checks skipped');
  } else {
    const detection = detectTailwindVersion(cwd, [config.tailwind.css]);
    const configuredVersion = config.tailwind.version;

    if (!detection.installed) {
      report('fail', 'Tailwind CSS is not installed', 'Install tailwindcss.');
    } else if (
      configuredVersion != null &&
      detection.version != null &&
      configuredVersion !== detection.version
    ) {
      report(
        'warn',
        `components.json declares Tailwind v${configuredVersion} but v${detection.version} is installed (${detection.source})`,
      );
    } else {
      report(
        'pass',
        `Tailwind v${detection.version} detected (${detection.source})`,
      );
    }

    const cssPath = resolve(cwd, config.tailwind.css);
    const cssContent = existsSync(cssPath)
      ? readFileSync(cssPath, 'utf-8')
      : '';

    if ((configuredVersion ?? detection.version) === 4) {
      const configFiles = ['tailwind.config.js', 'tailwind.config.ts'];
      const legacyConfig = configFiles.find((file) =>
        existsSync(resolve(cwd, file)),
      );

      if (cssContent.includes('@import "tailwindcss"')) {
        report(
          'pass',
          `Tailwind v4 CSS entry present (${config.tailwind.css})`,
        );
      } else {
        report(
          'fail',
          `Global CSS is missing @import "tailwindcss"`,
          `Expected in ${config.tailwind.css}`,
        );
      }

      if (cssContent.includes('@import "tw-animate-css"')) {
        report('pass', 'tw-animate-css imported in global CSS');
      } else {
        report(
          'fail',
          'Global CSS is missing @import "tw-animate-css"',
          'Run `galaxy-design migrate tailwind --dry-run` to update the scaffold.',
        );
      }

      if (cssContent.includes('@theme inline')) {
        report('pass', 'Semantic theme bridge (@theme inline) present');
      } else {
        report(
          'warn',
          '@theme inline is missing from global CSS',
          'Semantic utilities (border-border, bg-background) need the theme bridge.',
        );
      }

      if (legacyConfig) {
        report(
          'warn',
          `Legacy Tailwind config found (${legacyConfig})`,
          'Kept intentionally via @config; remove it after upgrading fully.',
        );
      }
    } else {
      const configPath = config.tailwind.config;
      if (configPath && existsSync(resolve(cwd, configPath))) {
        report('pass', `Tailwind config found (${configPath})`);
      } else {
        report('fail', `Tailwind config missing (${configPath})`);
      }

      const configContent = configPath
        ? existsSync(resolve(cwd, configPath))
          ? readFileSync(resolve(cwd, configPath), 'utf-8')
          : ''
        : '';
      if (/tailwindcss-animate|animate/.test(configContent)) {
        report('pass', 'tailwindcss-animate plugin configured');
      } else {
        report(
          'warn',
          'tailwindcss-animate plugin not detected in Tailwind config',
          'Galaxy components use animate-in utilities.',
        );
      }
    }

    // utils file
    const utilsBase = config.aliases.utils
      .replace(/^@\//, '')
      .replace(/^(?:src\/)?/, '');
    // utilsBase is now alias-relative without a leading src (e.g. 'lib/utils').
    const utilsCandidates = hasSrcDirectory(cwd)
      ? [resolve(cwd, 'src', utilsBase), resolve(cwd, utilsBase)]
      : [resolve(cwd, utilsBase)];
    const utilsPath = utilsCandidates
      .flatMap((candidate) => [candidate, `${candidate}.ts`, `${candidate}.js`])
      .find((candidate) => existsSync(candidate));
    if (utilsPath) {
      report('pass', `Utils file exists (${config.aliases.utils})`);
    } else {
      report(
        'fail',
        `Utils file missing (${config.aliases.utils})`,
        'Run `galaxy-design init` to (re)create it.',
      );
    }
  }

  // 4. dependencies
  const packageJsonPath = resolve(cwd, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const required = ['clsx', 'tailwind-merge'];
    const frameworkDeps: Record<string, string[]> = {
      vue: ['radix-vue', 'lucide-vue-next'],
      nuxtjs: ['radix-vue', 'lucide-vue-next'],
      react: ['@radix-ui/react-slot', 'lucide-react'],
      nextjs: ['@radix-ui/react-slot', 'lucide-react'],
      angular: ['@radix-ng/primitives', 'lucide-angular'],
      'react-native': ['class-variance-authority', 'nativewind'],
      flutter: [],
    };

    for (const dep of [...required, ...(frameworkDeps[framework] ?? [])]) {
      if (allDeps[dep]) {
        report('pass', `${dep} installed`);
      } else {
        report(
          'fail',
          `${dep} not installed`,
          'Run `galaxy-design init` again or install it manually.',
        );
      }
    }

    if (framework !== 'flutter') {
      const mode =
        config.tailwind.version ??
        detectTailwindVersion(cwd, [config.tailwind.css]).version ??
        4;
      const mergeVersion = allDeps['tailwind-merge'] ?? '';
      const major = parseInt(
        mergeVersion.replace(/[^\d]/g, '').charAt(0) || '0',
        10,
      );
      const expectedMajor = mode === 3 ? 2 : 3;
      if (major === expectedMajor) {
        report('pass', `tailwind-merge v${major} matches Tailwind v${mode}`);
      } else if (major === 0) {
        report('warn', 'Could not determine tailwind-merge version');
      } else {
        report(
          'warn',
          `tailwind-merge v${major} may mismatch Tailwind v${mode}`,
          mode === 3
            ? 'Use tailwind-merge@^2.6.0 for v3.'
            : 'Use tailwind-merge@^3 for v4.',
        );
      }
    }
  } else {
    report('fail', 'package.json not found in project root');
  }

  // 5. components directory
  const componentsBase = config.aliases.components.replace(/^@\//, '');
  const componentsCandidates = hasSrcDirectory(cwd)
    ? [resolve(cwd, 'src', componentsBase), resolve(cwd, componentsBase)]
    : [resolve(cwd, componentsBase)];
  const componentsPath = componentsCandidates.find((candidate) =>
    existsSync(candidate),
  );
  if (componentsPath) {
    report(
      'pass',
      `Components directory exists (${config.aliases.components})`,
    );
  } else {
    report(
      'warn',
      `Components directory missing (${config.aliases.components})`,
      'It is created on the first `add`.',
    );
  }

  printSummary(checks, warnings, failures, passed);
}

function printSummary(
  checks: CheckStatus[],
  warnings: string[],
  failures: string[],
  passed: string[],
) {
  console.log('');
  const failedCount = failures.length;
  if (failedCount > 0) {
    console.log(chalk.red.bold(`✗ Doctor found ${failedCount} problem(s)`));
    process.exitCode = 1;
  } else {
    console.log(chalk.green.bold(`✓ Setup looks healthy`));
  }
  console.log(
    chalk.gray(
      `Summary: ${passed.length} passed, ${warnings.length} warning(s), ${failedCount} failed`,
    ),
  );
  void checks;
}
