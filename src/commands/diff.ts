import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import chalk from 'chalk';
import {
  loadComponentsConfig,
  hasComponentsConfig,
} from '../utils/components-config.js';
import {
  getFrameworkComponent,
  resolveFrameworkComponentName,
} from '../utils/framework-registry-service.js';
import {
  getComponentGitHubPath,
  fetchFileFromGitHub,
} from '../utils/github-fetcher.js';

interface DiffOptions {
  cwd: string;
}

interface FileDiff {
  component: string;
  file: string;
  status: 'added' | 'missing' | 'modified' | 'unchanged';
}

export async function diffCommand(
  componentsArg: string[] | undefined,
  options: DiffOptions,
) {
  const cwd = options.cwd;
  const components = componentsArg ?? [];

  if (!hasComponentsConfig(cwd)) {
    console.log(chalk.red('❌ Galaxy UI is not initialized in this project.'));
    console.log(
      chalk.gray('Run') +
        chalk.cyan(' galaxy-design init ') +
        chalk.gray('first.'),
    );
    process.exitCode = 1;
    return;
  }

  const config = loadComponentsConfig(cwd);
  if (!config) {
    console.log(chalk.red('❌ Failed to load components.json configuration.'));
    process.exitCode = 1;
    return;
  }

  const framework = config.framework;

  if (components.length === 0) {
    console.log(chalk.yellow('⚠ No components specified.'));
    console.log(chalk.gray('Usage: galaxy-design diff [components...]'));
    return;
  }

  const resolved: string[] = [];
  for (const input of components) {
    const resolvedName = resolveFrameworkComponentName(framework, input);
    if (!resolvedName) {
      console.log(chalk.yellow(`⚠ Component "${input}" not found. Skipping.`));
      continue;
    }
    resolved.push(resolvedName);
  }

  if (resolved.length === 0) {
    console.log(chalk.yellow('No valid components to diff.'));
    process.exitCode = 1;
    return;
  }

  const componentBase = config.aliases.components
    .replace(/^@\//, '')
    .replace(/^(?:src\/)?/, '');
  const usesSrcDir = hasSrcDir(cwd);
  const baseDir = usesSrcDir ? 'src/' : '';
  const destRoot = resolve(cwd, baseDir, componentBase, 'ui');

  console.log(
    chalk.bold.cyan(
      `\n🔍 Diffing ${resolved.length} component(s) against registry (pinned release source)\n`,
    ),
  );

  const allDiffs: FileDiff[] = [];

  for (const componentName of resolved) {
    const component = getFrameworkComponent(framework, componentName);
    if (!component) {
      console.log(chalk.yellow(`⚠ ${componentName}: not found in registry.`));
      continue;
    }

    console.log(chalk.bold(componentName));

    for (const file of component.files) {
      const localPath = join(destRoot, componentName, file);
      const relativePath = `${componentName}/${file}`;

      if (!existsSync(localPath)) {
        allDiffs.push({ component: componentName, file, status: 'missing' });
        console.log(`  ${chalk.red('missing')}  ${relativePath}`);
        continue;
      }

      const localContent = readFileSync(localPath, 'utf-8');
      let registryContent: string | null = null;

      try {
        const sourcePlatform =
          framework === 'nextjs'
            ? 'react'
            : framework === 'nuxtjs'
              ? 'vue'
              : framework;
        const githubPath = getComponentGitHubPath(
          sourcePlatform,
          componentName,
          file,
          component.type === 'block' ? 'blocks' : 'components',
        );
        registryContent = await fetchFileFromGitHub(githubPath);
      } catch {
        registryContent = null;
      }

      if (registryContent === null) {
        allDiffs.push({ component: componentName, file, status: 'missing' });
        console.log(
          `  ${chalk.red('missing')}  ${relativePath} (registry fetch failed)`,
        );
        continue;
      }

      const normalizedLocal = localContent.replace(/\r\n/g, '\n').trimEnd();
      const normalizedRegistry = registryContent
        .replace(/\r\n/g, '\n')
        .trimEnd();

      if (normalizedLocal === normalizedRegistry) {
        allDiffs.push({ component: componentName, file, status: 'unchanged' });
        console.log(`  ${chalk.green('unchanged')}  ${relativePath}`);
      } else {
        allDiffs.push({ component: componentName, file, status: 'modified' });
        console.log(`  ${chalk.yellow('modified')}  ${relativePath}`);
      }
    }
    console.log('');
  }

  const added = allDiffs.filter((d) => d.status === 'added');
  const missing = allDiffs.filter((d) => d.status === 'missing');
  const modified = allDiffs.filter((d) => d.status === 'modified');
  const unchanged = allDiffs.filter((d) => d.status === 'unchanged');

  console.log(
    chalk.gray(
      `Summary: ${unchanged.length} unchanged, ${modified.length} modified, ${missing.length} missing, ${added.length} added`,
    ),
  );

  if (missing.length > 0 || modified.length > 0) {
    process.exitCode = 1;
  }
}

function hasSrcDir(cwd: string): boolean {
  return existsSync(resolve(cwd, 'src'));
}
