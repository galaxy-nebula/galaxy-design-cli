import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  detectFramework,
  detectPackageManager,
  isGalaxyInitialized,
  isTailwindInstalled,
} from '../utils/detect.js';
import {
  loadConfig,
  createConfig,
  configExists,
  getDefaultConfig,
} from '../utils/config.js';
import { writeFile, ensureDir, fileExists } from '../utils/files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface InitOptions {
  yes?: boolean;
  cwd: string;
}

export async function initCommand(options: InitOptions) {
  console.log(chalk.bold.cyan('\n🌌 Galaxy UI CLI\n'));

  const cwd = options.cwd;

  // Check if already initialized
  if (await configExists(cwd)) {
    console.log(chalk.yellow('⚠ Galaxy UI is already initialized in this project.'));
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: 'Do you want to overwrite the existing configuration?',
      initial: false,
    });

    if (!overwrite) {
      console.log(chalk.gray('Initialization cancelled.'));
      return;
    }
  }

  // Detect framework
  const detectedFramework = detectFramework(cwd);

  if (detectedFramework === 'unknown') {
    console.log(
      chalk.red(
        '❌ Could not detect framework. Please ensure you are in a valid Angular, React, or Vue project.'
      )
    );
    return;
  }

  if (detectedFramework !== 'angular') {
    console.log(
      chalk.yellow(
        `⚠ Detected ${detectedFramework} framework, but Galaxy UI currently only supports Angular.`
      )
    );
    console.log(chalk.gray('Support for React and Vue is coming soon!'));
    return;
  }

  console.log(chalk.green(`✓ Detected ${chalk.bold(detectedFramework)} framework`));

  // Detect package manager
  const packageManager = detectPackageManager(cwd);
  console.log(chalk.green(`✓ Using ${chalk.bold(packageManager)} package manager`));

  // Get configuration from user
  let config = getDefaultConfig(detectedFramework);

  if (!options.yes) {
    const responses = await prompts([
      {
        type: 'text',
        name: 'componentsPath',
        message: 'Where would you like to place your components?',
        initial: config.componentsPath,
      },
      {
        type: 'text',
        name: 'utilsPath',
        message: 'Where would you like to place your utils file?',
        initial: config.utilsPath,
      },
      {
        type: 'confirm',
        name: 'configureTailwind',
        message: 'Would you like to configure Tailwind CSS?',
        initial: !isTailwindInstalled(cwd),
      },
    ]);

    if (!responses.componentsPath) {
      console.log(chalk.gray('Initialization cancelled.'));
      return;
    }

    config = {
      ...config,
      componentsPath: responses.componentsPath,
      utilsPath: responses.utilsPath,
    };
  }

  console.log('\n');

  // Install dependencies
  const spinner = ora('Installing dependencies...').start();

  const dependencies = ['lucide-angular@^0.548.0', 'clsx@^2.1.1', 'tailwind-merge@^3.3.1'];

  if (!isTailwindInstalled(cwd)) {
    dependencies.push('tailwindcss@^3.4.0', 'autoprefixer@^10.4.0', 'postcss@^8.4.0');
  }

  try {
    const installCommand =
      packageManager === 'npm'
        ? 'npm install'
        : packageManager === 'bun'
        ? 'bun add'
        : `${packageManager} add`;

    await execa(installCommand, dependencies, {
      cwd,
      shell: true,
    });

    spinner.succeed('Dependencies installed');
  } catch (error) {
    spinner.fail('Failed to install dependencies');
    console.error(chalk.red(error));
    return;
  }

  // Create directories
  const dirSpinner = ora('Creating directories...').start();

  try {
    const componentsDir = resolve(cwd, config.componentsPath);
    const utilsDir = dirname(resolve(cwd, config.utilsPath));

    ensureDir(componentsDir);
    ensureDir(utilsDir);

    dirSpinner.succeed('Directories created');
  } catch (error) {
    dirSpinner.fail('Failed to create directories');
    console.error(chalk.red(error));
    return;
  }

  // Create utils file
  const utilsSpinner = ora('Creating utils file...').start();

  try {
    const utilsPath = resolve(cwd, config.utilsPath);
    const templatePath = resolve(__dirname, '../templates/utils.ts.template');
    const template = readFileSync(templatePath, 'utf-8');

    writeFile(utilsPath, template);

    utilsSpinner.succeed('Utils file created');
  } catch (error) {
    utilsSpinner.fail('Failed to create utils file');
    console.error(chalk.red(error));
    return;
  }

  // Configure Tailwind
  if (!isTailwindInstalled(cwd) || !fileExists(resolve(cwd, 'tailwind.config.js'))) {
    const tailwindSpinner = ora('Configuring Tailwind CSS...').start();

    try {
      const tailwindConfigPath = resolve(cwd, 'tailwind.config.js');
      const templatePath = resolve(__dirname, '../templates/tailwind.config.template');
      const template = readFileSync(templatePath, 'utf-8');

      writeFile(tailwindConfigPath, template);

      tailwindSpinner.succeed('Tailwind CSS configured');
    } catch (error) {
      tailwindSpinner.fail('Failed to configure Tailwind CSS');
      console.error(chalk.red(error));
    }
  }

  // Save configuration
  const configSpinner = ora('Saving configuration...').start();

  try {
    await createConfig(cwd, config);
    configSpinner.succeed('Configuration saved');
  } catch (error) {
    configSpinner.fail('Failed to save configuration');
    console.error(chalk.red(error));
    return;
  }

  // Success message
  console.log('\n' + chalk.green.bold('✓ Galaxy UI initialized successfully!\n'));

  console.log(chalk.gray('Next steps:'));
  console.log(chalk.gray('  1. Run') + chalk.cyan(' galaxy add <component>') + chalk.gray(' to add components'));
  console.log(chalk.gray('  2. Import components in your Angular modules'));
  console.log(chalk.gray('  3. Start building amazing UIs! 🚀\n'));
}
