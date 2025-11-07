import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { resolve, join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { loadConfig, configExists } from '../utils/config.js';
import {
  loadComponentsConfig,
  hasComponentsConfig,
  getFrameworkFromConfig,
} from '../utils/components-config.js';
import {
  loadFrameworkRegistry,
  getFrameworkComponent,
  getFrameworkComponentDependencies,
  getAllFrameworkComponents,
} from '../utils/framework-registry.js';
import { writeFile, fileExists, readFile, ensureDir } from '../utils/files.js';
import { installDependencies } from '../utils/package-manager.js';
import type { Framework } from '../utils/config-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface AddOptions {
  all?: boolean;
  cwd: string;
}

export async function addCommand(components: string[], options: AddOptions) {
  const cwd = options.cwd;

  // Check if components.json exists (new config system)
  if (!hasComponentsConfig(cwd)) {
    console.log(chalk.red('❌ Galaxy UI is not initialized in this project.'));
    console.log(chalk.gray('Run') + chalk.cyan(' galaxy-ui init ') + chalk.gray('first.'));
    return;
  }

  // Load components.json configuration
  const componentsConfig = loadComponentsConfig(cwd);
  if (!componentsConfig) {
    console.log(chalk.red('❌ Failed to load components.json configuration.'));
    return;
  }

  const framework = componentsConfig.framework;
  console.log(chalk.gray(`Framework detected: ${chalk.cyan(framework)}\n`));

  // Load framework-specific registry
  const registry = loadFrameworkRegistry(framework);
  const allComponents = getAllFrameworkComponents(framework);

  // Determine which components to add
  let componentsToAdd: string[] = [];

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
        title: chalk.bold.cyan(category.charAt(0).toUpperCase() + category.slice(1)),
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
      // Check if component exists in registry
      if (allComponents[input]) {
        componentsToAdd.push(input);
      } else {
        console.log(chalk.yellow(`⚠ Component "${input}" not found. Skipping.`));
      }
    }
  }

  if (componentsToAdd.length === 0) {
    console.log(chalk.yellow('No valid components to add.'));
    return;
  }

  // Remove duplicates
  componentsToAdd = [...new Set(componentsToAdd)];

  console.log(chalk.bold.cyan(`\n📦 Adding ${componentsToAdd.length} component(s)...\n`));

  // Collect all dependencies
  const allDependencies: string[] = [];
  const allDevDependencies: string[] = [];

  // Add each component
  const results: { name: string; success: boolean; path?: string; error?: string }[] = [];

  for (const componentKey of componentsToAdd) {
    const component = getFrameworkComponent(framework, componentKey);

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
      const fullDestPath = resolve(cwd, destPath, 'ui');
      ensureDir(fullDestPath);

      // Get file extension based on framework
      const fileExtensions: Record<Framework, string> = {
        vue: '.vue',
        react: '.tsx',
        angular: '.component.ts',
        'react-native': '.tsx',
        flutter: '.dart',
      };
      const ext = fileExtensions[framework];

      // Create component folder
      const componentFolderPath = join(fullDestPath, componentKey);
      ensureDir(componentFolderPath);

      // Copy component files from source packages
      for (const file of component.files) {
        const fileName = file.includes('/') ? file.split('/').pop()! : file;
        const destFilePath = join(componentFolderPath, fileName);

        // Check if file already exists
        if (fileExists(destFilePath)) {
          spinner.warn(
            `${chalk.cyan(component.name)} - File already exists: ${fileName}`
          );
          continue;
        }

        // Get source path from packages (blocks/ or components/)
        const sourceFolder = component.type === 'block' ? 'blocks' : 'components';
        const packagePath = resolve(__dirname, '..', '..', '..', framework, 'src', sourceFolder, componentKey);
        const sourcePath = join(packagePath, file);

        // Try to read the source file
        if (fileExists(sourcePath)) {
          const content = readFile(sourcePath);
          writeFile(destFilePath, content);
        } else {
          // Try with capitalized component name
          const capitalizedFile = file.charAt(0).toUpperCase() + file.slice(1);
          const capitalizedSourcePath = join(packagePath, capitalizedFile);

          if (fileExists(capitalizedSourcePath)) {
            const content = readFile(capitalizedSourcePath);
            writeFile(destFilePath, content);
          } else {
            // Fallback to placeholder if source not found
            const placeholderContent = `// ${component.name} component for ${framework}\n// TODO: Component source not found at ${sourcePath}\n`;
            writeFile(destFilePath, placeholderContent);
          }
        }
      }

      spinner.succeed(
        `${chalk.green('✓')} Added ${chalk.cyan(component.name)} to ${chalk.gray(
          destPath + '/ui/' + componentKey + '/'
        )}`
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
        await installDependencies(uniqueDependencies, { cwd, dev: false, silent: true });
      }
      if (uniqueDevDependencies.length > 0) {
        await installDependencies(uniqueDevDependencies, { cwd, dev: true, silent: true });
      }
      installSpinner.succeed('Dependencies installed');
    } catch (error) {
      installSpinner.fail('Failed to install dependencies');
      console.log(chalk.yellow('Please install them manually:'));
      if (uniqueDependencies.length > 0) {
        console.log(chalk.gray(`  npm install ${uniqueDependencies.join(' ')}`));
      }
      if (uniqueDevDependencies.length > 0) {
        console.log(chalk.gray(`  npm install -D ${uniqueDevDependencies.join(' ')}`));
      }
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n');

  if (successful > 0) {
    console.log(
      chalk.green.bold(`✓ Successfully added ${successful} component(s)`)
    );
  }

  if (failed > 0) {
    console.log(chalk.red.bold(`✗ Failed to add ${failed} component(s)`));
    for (const result of results.filter(r => !r.success)) {
      console.log(chalk.red(`  - ${result.name}: ${result.error}`));
    }
  }

  // Next steps
  if (successful > 0) {
    console.log('\n' + chalk.gray('Next steps:'));

    switch (framework) {
      case 'vue':
        console.log(chalk.gray('  1. Import the components in your Vue component'));
        console.log(chalk.gray('  2. Use them in your template'));
        break;
      case 'react':
        console.log(chalk.gray('  1. Import the components in your React component'));
        console.log(chalk.gray('  2. Use them in your JSX'));
        break;
      case 'angular':
        console.log(chalk.gray('  1. Import the components in your Angular module or component'));
        console.log(chalk.gray('  2. Use them in your templates'));
        break;
    }

    console.log(chalk.gray('  3. Enjoy building with Galaxy UI! 🚀\n'));
  }
}
