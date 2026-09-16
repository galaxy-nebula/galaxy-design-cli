import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { resolve, join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import {
  loadComponentsConfig,
  hasComponentsConfig,
} from '../utils/components-config.js';
import { hasSrcDirectory } from '../utils/detect.js';
import {
  getFrameworkComponent,
  getFrameworkComponentDependencies,
  getAllFrameworkComponents,
  resolveFrameworkComponentGraph,
  resolveFrameworkComponentName,
} from '../utils/framework-registry-service.js';
import { ensureDir } from '../utils/files.js';
import {
  detectPackageManager,
  formatInstallCommand,
  installDependencies,
} from '../utils/package-manager.js';
import { copyComponentFilesToDirectory } from '../utils/component-copier.js';
import { generateAngularProvidersIndex } from '../utils/angular-provider-manager.js';

interface AddOptions {
  all?: boolean;
  cwd: string;
  overwrite?: boolean;
  registryUrl?: string;
}

interface AddResult {
  name: string;
  success: boolean;
  path?: string;
  error?: string;
  details?: string[];
}

export async function addCommand(components: string[], options: AddOptions) {
  const cwd = options.cwd;

  // Check if components.json exists (new config system)
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

  // Load components.json configuration
  const componentsConfig = loadComponentsConfig(cwd);
  if (!componentsConfig) {
    console.log(chalk.red('❌ Failed to load components.json configuration.'));
    process.exitCode = 1;
    return;
  }

  const framework = componentsConfig.framework;
  console.log(chalk.gray(`Framework detected: ${chalk.cyan(framework)}\n`));

  const allComponents = getAllFrameworkComponents(framework);

  // Determine which components to add
  let componentsToAdd: string[] = [];
  let invalidComponentRequested = false;

  if (options.all) {
    // Add all components
    componentsToAdd = Object.keys(allComponents);
  } else if (components.length === 0) {
    // Interactive mode
    const choices = [];

    // Create choices organized by category
    const categories = new Map<string, any[]>();

    for (const [key, component] of Object.entries(allComponents)) {
      const category = component.category || 'other';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push({ key, component });
    }

    for (const [category, items] of categories) {
      choices.push({
        title: chalk.bold.cyan(
          category.charAt(0).toUpperCase() + category.slice(1),
        ),
        value: `category:${category}`,
        disabled: true,
      });

      for (const { key, component } of items) {
        choices.push({
          title: `  ${component.name}`,
          description: component.description || '',
          value: key,
        });
      }
    }

    const response = await prompts({
      type: 'multiselect',
      name: 'components',
      message: 'Which components would you like to add?',
      choices,
      hint: '- Space to select. Return to submit',
    });

    if (!response.components || response.components.length === 0) {
      console.log(chalk.gray('No components selected.'));
      return;
    }

    componentsToAdd = response.components;
  } else {
    // Add specified components
    for (const input of components) {
      const resolvedName = resolveFrameworkComponentName(framework, input);

      if (resolvedName && allComponents[resolvedName]) {
        componentsToAdd.push(resolvedName);
      } else {
        invalidComponentRequested = true;
        console.log(
          chalk.yellow(`⚠ Component "${input}" not found. Skipping.`),
        );
      }
    }
  }

  if (componentsToAdd.length === 0) {
    console.log(chalk.yellow('No valid components to add.'));
    if (components.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  // Remove duplicates
  componentsToAdd = [...new Set(componentsToAdd)];

  componentsToAdd = resolveFrameworkComponentGraph(framework, componentsToAdd);

  console.log(
    chalk.bold.cyan(`\n📦 Adding ${componentsToAdd.length} component(s)...\n`),
  );

  // Collect all dependencies
  const allDependencies: string[] = [];
  const allDevDependencies: string[] = [];

  // Add each component
  const results: AddResult[] = [];

  for (const componentKey of componentsToAdd) {
    const component = getFrameworkComponent(framework, componentKey);
    let componentFileErrors: string[] = [];

    if (!component) {
      results.push({
        name: componentKey,
        success: false,
        error: 'Component not found in registry',
      });
      continue;
    }

    const spinner = ora(`Adding ${chalk.cyan(component.name)}...`).start();

    try {
      // Get component destination path from aliases
      const componentsAlias = componentsConfig.aliases.components;
      const destPath = componentsAlias.replace('@/', '');

      // Detect if project uses src/ directory and adjust path
      const usesSrcDir = hasSrcDirectory(cwd);
      const baseDir = usesSrcDir ? 'src/' : '';
      const fullDestPath = resolve(cwd, baseDir + destPath, 'ui');
      ensureDir(fullDestPath);

      // Create component folder
      const componentFolderPath = join(fullDestPath, componentKey);
      ensureDir(componentFolderPath);

      const copyResult = await copyComponentFilesToDirectory({
        componentName: componentKey,
        componentFiles: component.files,
        componentType: component.type,
        sourcePlatform: framework,
        targetPlatform: framework,
        targetDirectory: componentFolderPath,
        relativeTo: cwd,
        overwrite: options.overwrite === true,
        registryUrl: options.registryUrl,
        onSkippedFile: (fileName) => {
          spinner.warn(
            `${chalk.cyan(component.name)} - File already exists: ${fileName}`,
          );
        },
      });

      if (!copyResult.success) {
        componentFileErrors = [...copyResult.errors];
        throw new Error(
          `Missing or invalid files: ${copyResult.errors.length}`,
        );
      }

      spinner.succeed(
        `${chalk.green('✓')} Added ${chalk.cyan(component.name)} to ${chalk.gray(
          destPath + '/ui/' + componentKey + '/',
        )}`,
      );

      if (options.overwrite === true) {
        // Backup replaced files so users can roll back a forced overwrite.
        const backupDir = resolve(
          cwd,
          '.galaxy/backups/add',
          String(Date.now()),
          componentKey,
        );
        for (const file of component.files) {
          const localPath = join(componentFolderPath, file);
          if (existsSync(localPath)) {
            const backupPath = join(backupDir, file);
            mkdirSync(dirname(backupPath), { recursive: true });
            writeFileSync(backupPath, readFileSync(localPath, 'utf-8'));
          }
        }
      }

      // Record installed file manifest for `update`/`diff` tracking
      const installedManifestPath = resolve(
        cwd,
        '.galaxy',
        'installed-components.json',
      );
      let installedManifest: Record<string, string[]> = {};
      if (existsSync(installedManifestPath)) {
        try {
          installedManifest = JSON.parse(
            readFileSync(installedManifestPath, 'utf-8'),
          );
        } catch {
          installedManifest = {};
        }
      }
      installedManifest[componentKey] = component.files;
      const installedDir = dirname(installedManifestPath);
      if (!existsSync(installedDir)) {
        mkdirSync(installedDir, { recursive: true });
      }
      writeFileSync(
        installedManifestPath,
        `${JSON.stringify(installedManifest, null, 2)}\n`,
      );

      results.push({
        name: component.name,
        success: true,
        path: componentFolderPath,
      });

      // Collect dependencies
      const deps = getFrameworkComponentDependencies(framework, componentKey);
      allDependencies.push(...deps.dependencies);
      allDevDependencies.push(...deps.devDependencies);
    } catch (error) {
      spinner.fail(`Failed to add ${chalk.cyan(component.name)}`);
      results.push({
        name: component.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: componentFileErrors,
      });
    }
  }

  // Install dependencies
  const uniqueDependencies = [...new Set(allDependencies)];
  const uniqueDevDependencies = [...new Set(allDevDependencies)];

  if (uniqueDependencies.length > 0 || uniqueDevDependencies.length > 0) {
    console.log('\n');
    const installSpinner = ora('Installing dependencies...').start();

    try {
      if (uniqueDependencies.length > 0) {
        await installDependencies(uniqueDependencies, {
          cwd,
          dev: false,
          silent: true,
        });
      }
      if (uniqueDevDependencies.length > 0) {
        await installDependencies(uniqueDevDependencies, {
          cwd,
          dev: true,
          silent: true,
        });
      }
      installSpinner.succeed('Dependencies installed');
    } catch (error) {
      installSpinner.fail('Failed to install dependencies');
      process.exitCode = 1;
      console.log(chalk.yellow('Please install them manually:'));
      const packageManager = detectPackageManager(cwd);
      if (uniqueDependencies.length > 0) {
        console.log(
          chalk.gray(
            `  ${formatInstallCommand(packageManager, uniqueDependencies)}`,
          ),
        );
      }
      if (uniqueDevDependencies.length > 0) {
        console.log(
          chalk.gray(
            `  ${formatInstallCommand(packageManager, uniqueDevDependencies, true)}`,
          ),
        );
      }
    }
  }

  // Summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log('\n');

  if (successful > 0) {
    console.log(
      chalk.green.bold(`✓ Successfully added ${successful} component(s)`),
    );
  }

  if (failed > 0) {
    process.exitCode = 1;
    console.log(chalk.red.bold(`✗ Failed to add ${failed} component(s)`));
    for (const result of results.filter((r) => !r.success)) {
      console.log(chalk.red(`  - ${result.name}: ${result.error}`));
      if (result.details && result.details.length > 0) {
        for (const detail of result.details) {
          console.log(chalk.gray(`    ${detail}`));
        }
      }
    }
  }

  if (invalidComponentRequested) {
    process.exitCode = 1;
  }

  // For Angular, generate/update the components/ui/index.ts file with providers
  if (framework === 'angular' && successful > 0) {
    console.log('\n');
    const providerSpinner = ora('Generating providers index...').start();

    try {
      const componentsAlias = componentsConfig.aliases.components;
      const destPath = componentsAlias.replace('@/', '');
      const usesSrcDir = hasSrcDirectory(cwd);
      const baseDir = usesSrcDir ? 'src/' : '';
      const fullDestPath = resolve(cwd, baseDir + destPath, 'ui');

      const success = generateAngularProvidersIndex(fullDestPath, framework);

      if (success) {
        providerSpinner.succeed(
          'Generated providers index at ' +
            chalk.cyan(`${destPath}/ui/index.ts`),
        );
      } else {
        providerSpinner.warn('Could not generate providers index');
      }
    } catch (error) {
      providerSpinner.fail('Failed to generate providers index');
    }
  }

  // Next steps
  if (successful > 0) {
    console.log('\n' + chalk.gray('Next steps:'));

    const nextSteps: string[] = [];

    switch (framework) {
      case 'vue':
      case 'nuxtjs':
        nextSteps.push('Import the components in your Vue component');
        nextSteps.push('Use them in your template');
        break;
      case 'react':
      case 'nextjs':
        nextSteps.push('Import the components in your React component');
        nextSteps.push('Use them in your JSX');
        break;
      case 'angular':
        nextSteps.push(
          'Import provideGalaxyComponents() in your app.config.ts providers array',
        );
        nextSteps.push('Import the components in your Angular component');
        nextSteps.push('Use them in your templates');
        break;
      case 'react-native':
        nextSteps.push(
          'Import the components in your React Native screen or component',
        );
        nextSteps.push(
          'Ensure your NativeWind and alias configuration resolves `@/*` imports',
        );
        break;
      case 'flutter':
        nextSteps.push('Import the generated widgets in your Dart files');
        nextSteps.push(
          'Run `flutter pub get` if new Dart dependencies were added',
        );
        break;
    }

    nextSteps.push('Enjoy building with Galaxy UI!');

    nextSteps.forEach((step, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${step}`));
    });

    console.log('');
  }
}
