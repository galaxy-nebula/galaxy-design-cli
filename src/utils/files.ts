import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write a file, creating directories if needed
 */
export function writeFile(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Read a file as string
 */
export function readFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Get the component path based on the user's config or defaults
 */
export function getComponentPath(cwd: string, componentName: string, config?: { componentsPath?: string }): string {
  const componentsDir = config?.componentsPath || 'src/components/ui';
  return resolve(cwd, componentsDir, componentName);
}

/**
 * Get the utils path based on the user's config or defaults
 */
export function getUtilsPath(cwd: string, config?: { utilsPath?: string }): string {
  return resolve(cwd, config?.utilsPath || 'src/lib/utils.ts');
}

/**
 * Copy component files from source to destination
 */
export function copyComponentFiles(
  sourcePath: string,
  destPath: string,
  files: string[]
): void {
  for (const file of files) {
    const source = resolve(sourcePath, file);
    const dest = resolve(destPath, file);

    if (existsSync(source)) {
      const content = readFile(source);
      writeFile(dest, content);
    }
  }
}
