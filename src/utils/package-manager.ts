import { execa } from 'execa';
import { existsSync } from 'fs';
import { join } from 'path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Detect which package manager is being used in the project
 */
export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  // Check for lock files
  if (existsSync(join(cwd, 'bun.lockb')) || existsSync(join(cwd, 'bun.lock'))) {
    return 'bun';
  }
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(cwd, 'package-lock.json'))) {
    return 'npm';
  }

  // Default to npm
  return 'npm';
}

/**
 * Get the install command for the detected package manager
 */
export function getInstallCommand(packageManager: PackageManager, packages: string[]): string[] {
  switch (packageManager) {
    case 'bun':
      return ['bun', 'add', ...packages];
    case 'pnpm':
      return ['pnpm', 'add', ...packages];
    case 'yarn':
      return ['yarn', 'add', ...packages];
    case 'npm':
    default:
      return ['npm', 'install', ...packages];
  }
}

/**
 * Install dependencies using the detected package manager
 */
export async function installDependencies(
  packages: string[],
  options: {
    cwd?: string;
    dev?: boolean;
    silent?: boolean;
  } = {}
): Promise<void> {
  const { cwd = process.cwd(), dev = false, silent = false } = options;

  if (packages.length === 0) {
    return;
  }

  const packageManager = detectPackageManager(cwd);
  let command: string[];
  let args: string[];

  switch (packageManager) {
    case 'bun':
      command = ['bun'];
      args = ['add', ...(dev ? ['-D'] : []), ...packages];
      break;
    case 'pnpm':
      command = ['pnpm'];
      args = ['add', ...(dev ? ['-D'] : []), ...packages];
      break;
    case 'yarn':
      command = ['yarn'];
      args = ['add', ...(dev ? ['-D'] : []), ...packages];
      break;
    case 'npm':
    default:
      command = ['npm'];
      args = ['install', ...(dev ? ['--save-dev'] : []), ...packages];
      break;
  }

  if (!silent) {
    console.log(`Installing dependencies with ${packageManager}...`);
  }

  try {
    // For bun, try to use full path if available
    let executable = command[0];
    if (packageManager === 'bun') {
      const bunPaths = [
        process.env.BUN_INSTALL ? `${process.env.BUN_INSTALL}/.bun/bin/bun` : null,
        process.env.HOME ? `${process.env.HOME}/.bun/bin/bun` : null,
        '/Users/buitronghieu/.bun/bin/bun',
      ].filter(Boolean) as string[];

      for (const bunPath of bunPaths) {
        try {
          await execa(bunPath, ['--version'], { stdio: 'ignore' });
          executable = bunPath;
          break;
        } catch {
          // Try next path
        }
      }
    }

    await execa(executable, args, {
      cwd,
      stdio: silent ? 'ignore' : 'inherit',
    });

    if (!silent) {
      console.log('✓ Dependencies installed successfully');
    }
  } catch (error) {
    console.error('Failed to install dependencies:', error);
    throw error;
  }
}

/**
 * Get the package manager executable name
 */
export function getPackageManagerExecutable(packageManager: PackageManager): string {
  return packageManager;
}

/**
 * Check if a package manager is available
 */
export async function isPackageManagerAvailable(packageManager: PackageManager): Promise<boolean> {
  try {
    await execa(packageManager, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
