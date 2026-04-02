import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export type TailwindMajor = 3 | 4 | null;

export interface TailwindDetectionResult {
  installed: boolean;
  version: TailwindMajor;
  source: 'package-json' | 'postcss-config' | 'css-import' | 'unknown';
  cssPath?: string;
  postcssConfigPath?: string;
  configPath?: string;
}

const POSTCSS_CONFIG_FILES = [
  'postcss.config.mjs',
  'postcss.config.js',
  'postcss.config.cjs',
];

const TAILWIND_CONFIG_FILES = [
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
];

const COMMON_CSS_FILES = [
  'app/globals.css',
  'src/app/globals.css',
  'src/index.css',
  'src/styles.css',
  'src/style.css',
  'assets/css/main.css',
  'global.css',
];

function readTextIfExists(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function detectTailwindMajorFromRange(versionRange?: string): TailwindMajor {
  if (!versionRange) {
    return null;
  }

  const match = versionRange.match(/(\d+)/);
  if (!match) {
    return null;
  }

  const major = Number(match[1]);
  if (major === 3 || major === 4) {
    return major;
  }

  return null;
}

function findFirstExistingFile(
  cwd: string,
  candidates: string[],
): string | undefined {
  for (const candidate of candidates) {
    if (existsSync(resolve(cwd, candidate))) {
      return candidate;
    }
  }

  return undefined;
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter(Boolean)));
}

export function detectTailwindVersion(
  cwd: string,
  cssPathHints: string[] = [],
): TailwindDetectionResult {
  const packageJsonPath = resolve(cwd, 'package.json');
  const postcssConfigPath = findFirstExistingFile(cwd, POSTCSS_CONFIG_FILES);
  const configPath = findFirstExistingFile(cwd, TAILWIND_CONFIG_FILES);

  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, 'utf-8'),
      ) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (dependencies['@tailwindcss/postcss']) {
        return {
          installed: true,
          version: 4,
          source: 'package-json',
          postcssConfigPath,
          configPath,
        };
      }

      const packageVersion = detectTailwindMajorFromRange(
        dependencies.tailwindcss,
      );
      if (packageVersion) {
        return {
          installed: true,
          version: packageVersion,
          source: 'package-json',
          postcssConfigPath,
          configPath,
        };
      }
    } catch {
      // Fall through to content-based detection.
    }
  }

  if (postcssConfigPath) {
    const postcssContent = readTextIfExists(resolve(cwd, postcssConfigPath));
    if (postcssContent?.includes('@tailwindcss/postcss')) {
      return {
        installed: true,
        version: 4,
        source: 'postcss-config',
        postcssConfigPath,
        configPath,
      };
    }

    if (postcssContent && /tailwindcss/.test(postcssContent)) {
      return {
        installed: true,
        version: 3,
        source: 'postcss-config',
        postcssConfigPath,
        configPath,
      };
    }
  }

  const cssCandidates = uniquePaths([...cssPathHints, ...COMMON_CSS_FILES]);
  for (const cssPath of cssCandidates) {
    const cssContent = readTextIfExists(resolve(cwd, cssPath));
    if (!cssContent) {
      continue;
    }

    if (/[@]import\s+['\"]tailwindcss['\"]/.test(cssContent)) {
      return {
        installed: true,
        version: 4,
        source: 'css-import',
        cssPath,
        postcssConfigPath,
        configPath,
      };
    }

    if (/[@]tailwind\s+(base|components|utilities)/.test(cssContent)) {
      return {
        installed: true,
        version: 3,
        source: 'css-import',
        cssPath,
        postcssConfigPath,
        configPath,
      };
    }
  }

  return {
    installed: Boolean(postcssConfigPath || configPath),
    version: null,
    source: 'unknown',
    postcssConfigPath,
    configPath,
  };
}

export function resolveTailwindMode(
  detection: TailwindDetectionResult,
  requestedVersion?: TailwindMajor,
): 'v3' | 'v4' {
  if (requestedVersion === 3) {
    return 'v3';
  }

  if (requestedVersion === 4) {
    return 'v4';
  }

  if (detection.version === 3) {
    return 'v3';
  }

  return 'v4';
}
