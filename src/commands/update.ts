import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import chalk from 'chalk';
import { copyComponentFilesToDirectory } from '../utils/component-copier.js';
import {
  getFrameworkComponent,
  resolveFrameworkComponentName,
} from '../utils/framework-registry-service.js';
import {
  loadComponentsConfig,
  hasComponentsConfig,
} from '../utils/components-config.js';
import { ensureDir } from '../utils/files.js';

interface UpdateOptions {
  cwd: string;
}

export async function updateCommand(
  componentsArg: string[] | undefined,
  options: UpdateOptions,
) {
  const cwd = options.cwd;
  const components = componentsArg ?? [];

  if (!hasComponentsConfig(cwd)) {
    console.log(chalk.red('❌ Galaxy UI is not initialized in this project.'));
    process.exitCode = 1;
    return;
  }

  const config = loadComponentsConfig(cwd);
  if (!config) {
    console.log(chalk.red('❌ Failed to load components.json configuration.'));
    process.exitCode = 1;
    return;
  }

  if (components.length === 0) {
    console.log(chalk.yellow('⚠ No components specified.'));
    console.log(chalk.gray('Usage: galaxy-design update [components...]'));
    process.exitCode = 1;
    return;
  }

  const framework = config.framework;
  const componentBase = config.aliases.components
    .replace(/^@\//, '')
    .replace(/^(?:src\/)?/, '');
  const usesSrcDir = existsSync(resolve(cwd, 'src'));
  const baseDir = usesSrcDir ? 'src/' : '';
  const destRoot = resolve(cwd, baseDir, componentBase, 'ui');
  const backupRoot = resolve(cwd, '.galaxy/backups/update', String(Date.now()));

  const results: Array<{ component: string; ok: boolean; message: string }> =
    [];

  for (const input of components) {
    const componentName = input;
    const componentDir = join(destRoot, componentName);

    if (!existsSync(componentDir)) {
      results.push({
        component: componentName,
        ok: false,
        message: 'not installed — run `add` first',
      });
      continue;
    }

    const filesToBackup: string[] = [];
    const installedManifestPath = resolve(
      cwd,
      '.galaxy',
      'installed-components.json',
    );

    let files: string[] = [];
    try {
      const installed = JSON.parse(
        readFileSync(installedManifestPath, 'utf-8'),
      ) as Record<string, string[]>;
      files = installed[componentName] ?? [];
    } catch {
      files = [];
    }

    if (files.length === 0) {
      results.push({
        component: componentName,
        ok: false,
        message:
          'no installed file manifest — run `add` to (re)install with tracking',
      });
      continue;
    }

    for (const file of files) {
      const localPath = join(componentDir, file);
      if (existsSync(localPath)) {
        filesToBackup.push(localPath);
      }
    }

    const backupDir = join(backupRoot, componentName);
    for (const filePath of filesToBackup) {
      const relative = filePath.slice(destRoot.length + 1);
      const backupPath = join(backupRoot, relative);
      mkdirSync(dirname(backupPath), { recursive: true });
      writeFileSync(backupPath, readFileSync(filePath, 'utf-8'));
    }

    const copyResult = await copyComponentFilesToDirectory({
      componentName,
      componentFiles: files,
      sourcePlatform: framework,
      targetPlatform: framework,
      targetDirectory: componentDir,
      relativeTo: cwd,
      overwrite: true,
      dryRun: false,
    });

    if (copyResult.success) {
      results.push({
        component: componentName,
        ok: true,
        message: `updated ${copyResult.filesCopied.length} file(s) (backup: ${backupRoot})`,
      });
    } else {
      results.push({
        component: componentName,
        ok: false,
        message: `failed: ${copyResult.errors.join('; ')}`,
      });
    }
  }

  console.log(chalk.bold.cyan('\n🔄 Galaxy UI Update\n'));

  let failed = 0;
  for (const result of results) {
    if (result.ok) {
      console.log(chalk.green('✓'), `${result.component} — ${result.message}`);
    } else {
      failed += 1;
      console.log(chalk.red('✗'), `${result.component} — ${result.message}`);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}
