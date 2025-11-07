import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export type Framework = 'angular' | 'react' | 'vue' | 'react-native' | 'flutter' | 'unknown';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pub';

/**
 * Detect the framework being used in the project
 */
export function detectFramework(cwd: string): Framework {
  // Check for Flutter first (uses pubspec.yaml instead of package.json)
  const pubspecPath = resolve(cwd, 'pubspec.yaml');
  if (existsSync(pubspecPath)) {
    return 'flutter';
  }

  const packageJsonPath = resolve(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return 'unknown';
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for React Native (must be before React check)
    if (deps['react-native']) {
      return 'react-native';
    }

    if (deps['@angular/core']) {
      return 'angular';
    }
    if (deps['react']) {
      return 'react';
    }
    if (deps['vue']) {
      return 'vue';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Detect the package manager being used
 */
export function detectPackageManager(cwd: string): PackageManager {
  // Check for Flutter package manager
  if (existsSync(resolve(cwd, 'pubspec.yaml'))) {
    return 'pub';
  }

  if (existsSync(resolve(cwd, 'bun.lockb')) || existsSync(resolve(cwd, 'bun.lock'))) {
    return 'bun';
  }
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(resolve(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  return 'npm';
}

/**
 * Check if project is already initialized with Galaxy UI
 */
export function isGalaxyInitialized(cwd: string): boolean {
  const packageJsonPath = resolve(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    return !!(deps['lucide-angular'] && deps['clsx'] && deps['tailwind-merge']);
  } catch {
    return false;
  }
}

/**
 * Check if Tailwind CSS is installed
 */
export function isTailwindInstalled(cwd: string): boolean {
  const packageJsonPath = resolve(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    return !!deps['tailwindcss'];
  } catch {
    return false;
  }
}
