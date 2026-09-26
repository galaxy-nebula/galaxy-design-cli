import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { writeFile } from './files.js';
import type { Framework } from './config-schema.js';

export function getUtilsTemplate(
  framework: Framework,
  typescript: boolean,
): { fileExtension: '.ts' | '.js'; content: string } | null {
  if (framework === 'flutter') {
    return null;
  }

  if (framework === 'react-native') {
    return {
      fileExtension: typescript ? '.ts' : '.js',
      content: typescript
        ? `import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
`
        : `import { clsx } from 'clsx';

export function cn(...inputs) {
  return clsx(inputs);
}
`,
    };
  }

  return {
    fileExtension: typescript ? '.ts' : '.js',
    content: typescript
      ? `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`
      : `import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
`,
  };
}

export function writeInitUtilityFile(options: {
  cwd: string;
  framework: Framework;
  typescript: boolean;
  usesSrcDir: boolean;
  utilsAlias: string;
}): boolean {
  const utilsTemplate = getUtilsTemplate(options.framework, options.typescript);
  if (!utilsTemplate) {
    return false;
  }

  const baseDir = options.usesSrcDir ? 'src/' : '';
  const utilsPath = resolve(
    options.cwd,
    baseDir +
      options.utilsAlias.replace('@/', '') +
      utilsTemplate.fileExtension,
  );
  writeFile(utilsPath, utilsTemplate.content);
  return true;
}

export function configureProjectAliases(options: {
  cwd: string;
  framework: Framework;
  typescript: boolean;
  usesSrcDir: boolean;
}): void {
  if (!options.typescript || options.framework === 'flutter') {
    return;
  }

  if (
    options.framework === 'react' ||
    options.framework === 'angular' ||
    options.framework === 'vue'
  ) {
    configureTypeScriptAliases(
      options.cwd,
      'tsconfig.app.json',
      options.usesSrcDir,
    );
  } else if (
    options.framework === 'nextjs' ||
    options.framework === 'react-native'
  ) {
    configureTypeScriptAliases(
      options.cwd,
      'tsconfig.json',
      options.usesSrcDir,
    );
  }

  if (options.framework === 'react' || options.framework === 'vue') {
    configureViteAliases(options.cwd, 'vite.config.ts');
  }
}

function configureTypeScriptAliases(
  cwd: string,
  tsconfigFile: string,
  usesSrcDir: boolean,
): void {
  const tsconfigPath = resolve(cwd, tsconfigFile);

  if (!existsSync(tsconfigPath)) {
    return;
  }

  try {
    let content = readFileSync(tsconfigPath, 'utf-8');
    const pathMapping = usesSrcDir ? './src/*' : './*';

    if (content.includes('"paths"')) {
      return;
    }

    const compilerOptionsMatch = content.match(/"compilerOptions"\s*:\s*{/);
    if (!compilerOptionsMatch) {
      throw new Error('compilerOptions not found');
    }

    const insertPattern =
      /(\n)(\s*)(}\s*,?\s*\n\s*"(?:include|exclude|files|references))/;
    const match = content.match(insertPattern);

    if (match) {
      const baseIndent = match[2] || '  ';
      const propertyIndent = baseIndent + '  ';
      const pathConfig = `,${match[1]}${propertyIndent}/* Path Aliases */${match[1]}${propertyIndent}${match[1]}${propertyIndent}"paths": {${match[1]}${propertyIndent}  "@/*": ["${pathMapping}"]${match[1]}${propertyIndent}}`;

      content = content.replace(
        insertPattern,
        `${pathConfig}${match[1]}${match[2]}${match[3]}`,
      );
      writeFileSync(tsconfigPath, content, 'utf-8');
    }
  } catch {
    // Non-critical best-effort alias config.
  }
}

function configureViteAliases(cwd: string, viteConfigFile: string): void {
  const viteConfigPath = resolve(cwd, viteConfigFile);

  if (!existsSync(viteConfigPath)) {
    return;
  }

  try {
    let content = readFileSync(viteConfigPath, 'utf-8');

    if (
      !content.includes("import path from 'path'") &&
      !content.includes('import path from "path"') &&
      !content.includes("import path from 'node:path'") &&
      !content.includes('import path from "node:path"')
    ) {
      content = content.replace(
        /(import .+ from .+\n)/,
        "$1import path from 'path'\n",
      );
    }

    if (!content.includes('resolve:') && !content.includes('@:')) {
      content = content.replace(
        /(plugins: \[.+\],?)/s,
        `$1\n  resolve: {\n    alias: {\n      '@': path.resolve(__dirname, './src'),\n    },\n  },`,
      );
    }

    writeFileSync(viteConfigPath, content, 'utf-8');
  } catch {
    console.error(chalk.yellow(`Warning: Could not update ${viteConfigFile}`));
  }
}
