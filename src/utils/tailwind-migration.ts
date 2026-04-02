import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { resolve, join, extname, relative, dirname } from 'path';
import type { Framework, ComponentsConfig } from './config-schema.js';
import { detectFramework } from './detect.js';
import {
  detectTailwindVersion,
  type TailwindDetectionResult,
} from './tailwind-detector.js';
import {
  loadComponentsConfig,
  saveComponentsConfig,
} from './components-config.js';

const TAILWIND_V4_RANGE = '^4.1.16';

export interface TailwindAuditFinding {
  filePath: string;
  pattern: string;
  matches: string[];
  message: string;
}

export interface TailwindMigrationPlan {
  framework: Framework;
  cssPath: string;
  postcssConfigPath: string;
  detection: TailwindDetectionResult;
  addedDevDependencies: string[];
  removedPackages: string[];
  filesToUpdate: string[];
  notes: string[];
  auditFindings: TailwindAuditFinding[];
  willUpdateComponentsConfig: boolean;
}

export interface TailwindMigrationResult {
  filesUpdated: string[];
  addedDevDependencies: string[];
  removedPackages: string[];
  auditFindings: TailwindAuditFinding[];
  componentsConfigUpdated: boolean;
}

interface PackageJsonShape {
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface AuditPattern {
  name: string;
  matcher: RegExp;
  message: string;
}

interface AuditTarget {
  filePath: string;
  content: string;
}

const AUDIT_PATTERNS: AuditPattern[] = [
  {
    name: 'outline-none',
    matcher: /\boutline-none\b/g,
    message:
      'Tailwind v4 often expects outline-hidden instead of outline-none.',
  },
  {
    name: 'ring',
    matcher: /\bring\b/g,
    message:
      'Bare ring now maps differently in v4; review whether ring-3 or another explicit width is intended.',
  },
  {
    name: 'shadow-sm',
    matcher: /\bshadow-sm\b/g,
    message:
      'Review shadow-sm because Tailwind v4 changed parts of the size scale.',
  },
  {
    name: 'rounded-sm',
    matcher: /\brounded-sm\b/g,
    message:
      'Review rounded-sm because Tailwind v4 changed parts of the size scale.',
  },
  {
    name: 'blur-sm',
    matcher: /\bblur-sm\b/g,
    message:
      'Review blur-sm because Tailwind v4 changed parts of the size scale.',
  },
  {
    name: 'bg-opacity-*',
    matcher: /\bbg-opacity-\d+\b/g,
    message:
      'Opacity utility shorthands were removed; prefer slash opacity syntax in v4.',
  },
  {
    name: 'text-opacity-*',
    matcher: /\btext-opacity-\d+\b/g,
    message:
      'Opacity utility shorthands were removed; prefer slash opacity syntax in v4.',
  },
];

const SCAN_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.html',
  '.css',
  '.mdx',
]);

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.angular',
  'coverage',
]);

const CONFIG_FILE_CANDIDATES = [
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts',
  'tailwind.config.cts',
  'tailwind.config.mts',
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',
  'postcss.config.ts',
];

const CONFIG_AUDIT_PATTERNS: AuditPattern[] = [
  {
    name: '@layer utilities',
    matcher: /@layer\s+utilities\b/g,
    message:
      'Custom utilities declared with @layer utilities may depend on pre-v4 behavior and should be reviewed manually.',
  },
  {
    name: 'corePlugins',
    matcher: /\bcorePlugins\b/g,
    message:
      'corePlugins in JS config can behave differently in Tailwind v4 and may need a CSS-first replacement.',
  },
  {
    name: 'safelist',
    matcher: /\bsafelist\b/g,
    message:
      'safelist in JS config should be reviewed because Tailwind v4 encourages different content/config patterns.',
  },
  {
    name: 'separator',
    matcher: /\bseparator\b/g,
    message:
      'separator in JS config is legacy configuration and should be reviewed for Tailwind v4 compatibility.',
  },
];

function getPackageJson(cwd: string): { path: string; data: PackageJsonShape } {
  const packageJsonPath = resolve(cwd, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new Error('package.json not found in the target project');
  }

  return {
    path: packageJsonPath,
    data: JSON.parse(
      readFileSync(packageJsonPath, 'utf-8'),
    ) as PackageJsonShape,
  };
}

function getDefaultCssPath(framework: Framework): string {
  switch (framework) {
    case 'nextjs':
      return 'app/globals.css';
    case 'angular':
      return 'src/styles.css';
    default:
      return 'src/index.css';
  }
}

function resolveMigrationFramework(cwd: string): Framework {
  const config = loadComponentsConfig(cwd);
  if (config) {
    return config.framework;
  }

  const framework = detectFramework(cwd);
  if (framework === 'unknown') {
    throw new Error(
      'Could not detect a supported framework for Tailwind migration',
    );
  }

  return framework;
}

function resolveCssPath(cwd: string, framework: Framework): string {
  const config = loadComponentsConfig(cwd);
  const preferred = config?.tailwind.css || getDefaultCssPath(framework);

  if (existsSync(resolve(cwd, preferred))) {
    return preferred;
  }

  const detection = detectTailwindVersion(cwd, [preferred]);
  return detection.cssPath || preferred;
}

function determinePostcssConfigPath(
  cwd: string,
  detection: TailwindDetectionResult,
): string {
  if (detection.postcssConfigPath) {
    return detection.postcssConfigPath;
  }

  const { data } = getPackageJson(cwd);
  return data.type === 'module' ? 'postcss.config.mjs' : 'postcss.config.js';
}

function getPostcssV4Content(cwd: string, configPath: string): string {
  const extension = extname(configPath);
  const { data } = getPackageJson(cwd);
  const useEsm =
    extension === '.mjs' || (extension === '.js' && data.type === 'module');

  if (useEsm) {
    return `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
`;
  }

  return `module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
`;
}

function rewriteCssToV4(content: string): string {
  if (/[@]import\s+['"]tailwindcss['"]/.test(content)) {
    return content;
  }

  const lines = content.split('\n');
  const rewritten: string[] = [];
  let insertedImport = false;

  for (const line of lines) {
    if (/^\s*[@]tailwind\s+(base|components|utilities);?\s*$/.test(line)) {
      if (!insertedImport) {
        rewritten.push('@import "tailwindcss";');
        insertedImport = true;
      }
      continue;
    }

    rewritten.push(line);
  }

  if (!insertedImport) {
    rewritten.unshift('@import "tailwindcss";');
  }

  return `${rewritten.join('\n').replace(/^\n+/, '').trimEnd()}\n`;
}

function collectFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        files.push(...collectFiles(fullPath));
      }
      continue;
    }

    if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectAuditTargets(cwd: string): AuditTarget[] {
  const candidateRoots = ['src', 'app', 'components'].map((dir) =>
    resolve(cwd, dir),
  );
  const targets: AuditTarget[] = [];
  const visited = new Set<string>();

  for (const root of candidateRoots) {
    for (const filePath of collectFiles(root)) {
      if (visited.has(filePath)) {
        continue;
      }
      visited.add(filePath);
      targets.push({
        filePath,
        content: readFileSync(filePath, 'utf-8'),
      });
    }
  }

  for (const relativePath of CONFIG_FILE_CANDIDATES) {
    const filePath = resolve(cwd, relativePath);
    if (!existsSync(filePath) || visited.has(filePath)) {
      continue;
    }

    visited.add(filePath);
    targets.push({
      filePath,
      content: readFileSync(filePath, 'utf-8'),
    });
  }

  return targets;
}

export function auditTailwindV4Risks(cwd: string): TailwindAuditFinding[] {
  const findings: TailwindAuditFinding[] = [];
  const targets = collectAuditTargets(cwd);

  for (const target of targets) {
    const applicablePatterns =
      target.filePath.endsWith('.css') || target.filePath.endsWith('.scss')
        ? [...AUDIT_PATTERNS, ...CONFIG_AUDIT_PATTERNS]
        : target.filePath.includes('tailwind.config.') ||
            target.filePath.includes('postcss.config.')
          ? CONFIG_AUDIT_PATTERNS
          : AUDIT_PATTERNS;

    for (const pattern of applicablePatterns) {
      const matches = target.content.match(pattern.matcher);
      if (matches && matches.length > 0) {
        findings.push({
          filePath: relative(cwd, target.filePath),
          pattern: pattern.name,
          matches: [...new Set(matches)],
          message: pattern.message,
        });
      }
    }
  }

  return findings;
}

function computePackageChanges(packageJson: PackageJsonShape): {
  updated: PackageJsonShape;
  addedDevDependencies: string[];
  removedPackages: string[];
} {
  const updated: PackageJsonShape = {
    ...packageJson,
    dependencies: { ...(packageJson.dependencies || {}) },
    devDependencies: { ...(packageJson.devDependencies || {}) },
  };

  const addedDevDependencies: string[] = [];
  const removedPackages: string[] = [];

  if (updated.dependencies?.tailwindcss) {
    delete updated.dependencies.tailwindcss;
  }
  if (updated.dependencies?.['@tailwindcss/postcss']) {
    delete updated.dependencies['@tailwindcss/postcss'];
  }

  if (updated.devDependencies?.tailwindcss !== TAILWIND_V4_RANGE) {
    updated.devDependencies = updated.devDependencies || {};
    updated.devDependencies.tailwindcss = TAILWIND_V4_RANGE;
    addedDevDependencies.push(`tailwindcss@${TAILWIND_V4_RANGE}`);
  }

  if (updated.devDependencies?.['@tailwindcss/postcss'] !== TAILWIND_V4_RANGE) {
    updated.devDependencies = updated.devDependencies || {};
    updated.devDependencies['@tailwindcss/postcss'] = TAILWIND_V4_RANGE;
    addedDevDependencies.push(`@tailwindcss/postcss@${TAILWIND_V4_RANGE}`);
  }

  for (const dependencySection of [
    'dependencies',
    'devDependencies',
  ] as const) {
    const bucket = updated[dependencySection];
    if (bucket?.autoprefixer) {
      delete bucket.autoprefixer;
      removedPackages.push('autoprefixer');
    }
  }

  return {
    updated,
    addedDevDependencies: [...new Set(addedDevDependencies)],
    removedPackages: [...new Set(removedPackages)],
  };
}

function updateComponentsConfigVersion(cwd: string): boolean {
  const config = loadComponentsConfig(cwd);
  if (!config) {
    return false;
  }

  const updatedConfig: ComponentsConfig = {
    ...config,
    tailwind: {
      ...config.tailwind,
      version: 4,
    },
  };
  saveComponentsConfig(cwd, updatedConfig);
  return true;
}

export function planTailwindMigration(cwd: string): TailwindMigrationPlan {
  const framework = resolveMigrationFramework(cwd);

  if (framework === 'react-native' || framework === 'flutter') {
    throw new Error(
      'Tailwind migration currently supports web frameworks only',
    );
  }

  const cssPath = resolveCssPath(cwd, framework);
  const detection = detectTailwindVersion(cwd, [cssPath]);
  const postcssConfigPath = determinePostcssConfigPath(cwd, detection);
  const { data: packageJson } = getPackageJson(cwd);
  const packageChanges = computePackageChanges(packageJson);
  const auditFindings = auditTailwindV4Risks(cwd);
  const notes: string[] = [];

  if (detection.version !== 3) {
    notes.push(
      detection.version === 4
        ? 'Project already appears to use Tailwind v4.'
        : 'Tailwind v3 was not detected; migration will not be applied automatically.',
    );
  }

  if (
    auditFindings.some((finding) =>
      ['@layer utilities', 'corePlugins', 'safelist', 'separator'].includes(
        finding.pattern,
      ),
    )
  ) {
    notes.push(
      'Custom utility layers or legacy JS config options were detected; review those findings before treating the Tailwind v4 migration as complete.',
    );
  }

  const filesToUpdate = [postcssConfigPath, cssPath, 'package.json'];
  const hasComponentsConfig = Boolean(loadComponentsConfig(cwd));
  if (hasComponentsConfig) {
    filesToUpdate.push('components.json');
  }

  return {
    framework,
    cssPath,
    postcssConfigPath,
    detection,
    addedDevDependencies: packageChanges.addedDevDependencies,
    removedPackages: packageChanges.removedPackages,
    filesToUpdate,
    notes,
    auditFindings,
    willUpdateComponentsConfig: hasComponentsConfig,
  };
}

export function applyTailwindMigration(cwd: string): TailwindMigrationResult {
  const plan = planTailwindMigration(cwd);

  if (plan.detection.version !== 3) {
    throw new Error(
      plan.notes[0] || 'Tailwind v3 was not detected; nothing to migrate.',
    );
  }

  const { path: packageJsonPath, data: packageJson } = getPackageJson(cwd);
  const packageChanges = computePackageChanges(packageJson);
  writeFileSync(
    packageJsonPath,
    `${JSON.stringify(packageChanges.updated, null, 2)}\n`,
    'utf-8',
  );

  const cssFullPath = resolve(cwd, plan.cssPath);
  mkdirSync(dirname(cssFullPath), { recursive: true });
  const existingCss = existsSync(cssFullPath)
    ? readFileSync(cssFullPath, 'utf-8')
    : '';
  writeFileSync(cssFullPath, rewriteCssToV4(existingCss), 'utf-8');

  const postcssFullPath = resolve(cwd, plan.postcssConfigPath);
  mkdirSync(dirname(postcssFullPath), { recursive: true });
  writeFileSync(
    postcssFullPath,
    getPostcssV4Content(cwd, plan.postcssConfigPath),
    'utf-8',
  );

  const componentsConfigUpdated = updateComponentsConfigVersion(cwd);

  return {
    filesUpdated: plan.filesToUpdate,
    addedDevDependencies: plan.addedDevDependencies,
    removedPackages: plan.removedPackages,
    auditFindings: plan.auditFindings,
    componentsConfigUpdated,
  };
}
