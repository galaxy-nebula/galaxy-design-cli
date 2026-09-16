/**
 * P2.2 — Strip TypeScript types for JavaScript-only projects.
 * Uses SWC (already a dependency) to remove type annotations while
 * preserving JSX and runtime semantics.
 */

import { transformSync } from '@swc/core';

const EXTENSION_MAP: Record<string, string> = {
  '.ts': '.js',
  '.tsx': '.jsx',
};

export function shouldTransformToJs(
  filePath: string,
  typescript: boolean,
): boolean {
  if (typescript !== false) return false;
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
}

export function getJsOutputPath(filePath: string, typescript: boolean): string {
  if (typescript !== false) return filePath;
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return EXTENSION_MAP[ext] ?? filePath;
}

export function stripTypes(content: string, filePath: string): string {
  const isTsx = filePath.endsWith('.tsx');
  const isTs = filePath.endsWith('.ts');
  if (!isTsx && !isTs) return content;

  try {
    const result = transformSync(content, {
      filename: filePath,
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: isTsx,
          decorators: true,
        },
        target: 'es2022',
        externalHelpers: false,
      },
      module: { type: 'es6' },
      isModule: true,
      minify: false,
    });

    return result.code;
  } catch {
    // If SWC fails (e.g. syntax it can't handle), return original
    return content;
  }
}
