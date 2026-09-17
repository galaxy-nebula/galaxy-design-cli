import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import {
  applyInitPromptAnswers,
  detectExpoProject,
  ensureInitDirectories,
  getInitPromptQuestions,
  resolveInitProjectContext,
} from '../utils/init-workflow.js';
import {
  hasComponentsConfig,
  saveComponentsConfig,
} from '../utils/components-config.js';
import {
  getDefaultConfig,
  type Framework,
  type IconLibrary,
} from '../utils/config-schema.js';
import { installDependencies } from '../utils/package-manager.js';
import {
  configureProjectAliases,
  getUtilsTemplate,
  writeInitUtilityFile,
} from '../utils/init-scaffold.js';
import { scaffoldInitFrameworkRuntime } from '../utils/init-runtime.js';
import {
  getTailwindDevDependencies,
  getTailwindMergeDependency,
  type TailwindMode,
} from '../utils/tailwind-scaffold.js';

interface InitOptions {
  yes?: boolean;
  cwd: string;
  theme?: string;
}

interface InitDependencyPlan {
  dependencies: string[];
  devDependencies: string[];
}

export async function initCommand(options: InitOptions) {
  console.log(
    chalk.bold.cyan('\n🌌 Galaxy UI CLI - Multi-Framework Edition\n'),
  );

  const cwd = options.cwd;

  // Check if already initialized
  if (hasComponentsConfig(cwd)) {
    console.log(
      chalk.yellow('⚠ components.json already exists in this project.'),
    );
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

  let initContext;
  try {
    initContext = resolveInitProjectContext(cwd);
  } catch (error) {
    console.log(
      chalk.red(
        `❌ ${error instanceof Error ? error.message : 'Failed to inspect project.'}`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const {
    detectedFramework,
    framework,
    packageManager,
    usesSrcDir,
    isExpoProject,
    tailwindDetection,
    tailwindMode,
  } = initContext;
  let config = initContext.config;

  console.log(
    chalk.green(`✓ Detected ${chalk.bold(detectedFramework)} framework`),
  );
  console.log(
    chalk.green(`✓ Using ${chalk.bold(packageManager)} package manager`),
  );

  if (usesSrcDir) {
    console.log(
      chalk.green(`✓ Detected ${chalk.bold('src/')} directory structure`),
    );
  }

  if (framework !== 'flutter') {
    const tailwindSourceLabel =
      tailwindDetection.source === 'unknown'
        ? 'default'
        : tailwindDetection.source;
    console.log(
      chalk.green(
        `✓ Tailwind mode: ${chalk.bold(tailwindMode)} ${chalk.gray(`(${tailwindSourceLabel})`)}`,
      ),
    );
  }

  if (!options.yes) {
    console.log(chalk.cyan('\n📝 Configuration\n'));
    const answers = await prompts(getInitPromptQuestions(framework, config));

    if (Object.keys(answers).length === 0) {
      console.log(chalk.gray('Initialization cancelled.'));
      return;
    }

    config = applyInitPromptAnswers(config, answers);
  }

  console.log(chalk.cyan('\n📦 Installing dependencies...\n'));

  // Install dependencies
  const spinner = ora('Installing dependencies...').start();

  const { dependencies, devDependencies } = getInitDependencyPlan({
    framework,
    iconLibrary: config.iconLibrary,
    typescript: config.typescript,
    tailwindMode,
  });

  try {
    // Install dependencies
    if (dependencies.length > 0) {
      await installDependencies(dependencies, {
        cwd,
        silent: true,
      });
    }

    // Install devDependencies
    if (devDependencies.length > 0) {
      await installDependencies(devDependencies, {
        cwd,
        dev: true,
        silent: true,
      });
    }

    spinner.succeed('Dependencies installed');
  } catch (error) {
    spinner.fail('Failed to install dependencies');
    console.error(chalk.red(error));
    process.exitCode = 1;
    return;
  }

  // Create directories
  const dirSpinner = ora('Creating directories...').start();

  try {
    ensureInitDirectories(cwd, config, usesSrcDir);

    dirSpinner.succeed('Directories created');
  } catch (error) {
    dirSpinner.fail('Failed to create directories');
    console.error(chalk.red(error));
    process.exitCode = 1;
    return;
  }

  // Create utils file when the framework templates expect one
  const utilsSpinner = ora('Preparing utility functions...').start();

  try {
    const didWriteUtils = writeInitUtilityFile({
      cwd,
      framework,
      typescript: config.typescript,
      usesSrcDir,
      utilsAlias: config.aliases.utils,
    });

    if (didWriteUtils) {
      utilsSpinner.succeed('Utility functions created');
    } else {
      utilsSpinner.succeed('No utility file required for this framework');
    }
  } catch (error) {
    utilsSpinner.fail('Failed to create utility functions');
    console.error(chalk.red(error));
    process.exitCode = 1;
    return;
  }

  // Save components.json
  const configSpinner = ora('Creating components.json...').start();

  try {
    saveComponentsConfig(cwd, config);
    configSpinner.succeed('components.json created');
  } catch (error) {
    configSpinner.fail('Failed to create components.json');
    console.error(chalk.red(error));
    process.exitCode = 1;
    return;
  }

  if (framework !== 'flutter') {
    const runtimeLabel =
      framework === 'react-native'
        ? 'Configuring React Native runtime...'
        : 'Creating Tailwind CSS configuration...';
    const runtimeSpinner = ora(runtimeLabel).start();

    try {
      const scaffoldResult = scaffoldInitFrameworkRuntime({
        cwd,
        framework,
        tailwindMode,
        cssPath: config.tailwind.css,
        tailwindConfigPath: config.tailwind.config || 'tailwind.config.js',
        baseColor: config.tailwind.baseColor,
        theme: options.theme,
        usesSrcDir,
        isExpoProject,
      });

      runtimeSpinner.succeed(
        framework === 'react-native'
          ? `React Native runtime configured (${scaffoldResult?.written.length || 0} written, ${scaffoldResult?.skipped.length || 0} kept)`
          : `Tailwind CSS configuration created (${scaffoldResult?.written.length || 0} written, ${scaffoldResult?.skipped.length || 0} kept)`,
      );
    } catch (error) {
      runtimeSpinner.fail(
        framework === 'react-native'
          ? 'Failed to configure React Native runtime'
          : 'Failed to create Tailwind CSS configuration',
      );
      console.error(chalk.red(error));
      process.exitCode = 1;
      return;
    }
  }

  // Configure path aliases for TypeScript and bundler
  if (config.typescript && framework !== 'flutter') {
    const aliasSpinner = ora('Configuring path aliases...').start();

    try {
      configureProjectAliases({
        cwd,
        framework,
        typescript: config.typescript,
        usesSrcDir,
      });

      aliasSpinner.succeed('Path aliases configured');
    } catch (error) {
      aliasSpinner.fail('Failed to configure path aliases');
      console.error(chalk.red(error));
      // Don't return - this is not critical
    }
  }

  console.log(chalk.green('\n✨ Success! Galaxy UI has been initialized.\n'));
  console.log(chalk.cyan('Next steps:\n'));
  console.log(chalk.white('  1. Add components:'));
  console.log(chalk.gray('     galaxy-design add button'));
  console.log(chalk.gray('     galaxy-design add input card'));
  console.log(chalk.gray('     galaxy-design add --all\n'));

  if (framework === 'react-native') {
    console.log(
      chalk.white(
        '  2. Confirm your React Native entry file keeps the generated global stylesheet import.',
      ),
    );
  }

  if (framework === 'flutter') {
    console.log(
      chalk.white(
        '  2. Run `flutter pub get` if your project has pending Dart dependencies.',
      ),
    );
  }

  console.log(chalk.cyan('Learn more:'));
  console.log(chalk.white('  Documentation: https://galaxy-design.vercel.app'));
  console.log(
    chalk.white('  GitHub: https://github.com/buikevin/galaxy-design\n'),
  );
}

export function getInitDependencyPlan(options: {
  framework: Framework;
  iconLibrary: IconLibrary;
  typescript: boolean;
  tailwindMode: TailwindMode | null;
}): InitDependencyPlan {
  const { framework, iconLibrary, typescript, tailwindMode } = options;
  const dependencies: string[] = [];
  const devDependencies: string[] = [];
  const webTailwindMode = tailwindMode || 'v4';

  switch (framework) {
    case 'vue':
    case 'nuxtjs':
      dependencies.push(
        'clsx',
        getTailwindMergeDependency(webTailwindMode),
        'radix-vue',
      );
      devDependencies.push(...getTailwindDevDependencies(webTailwindMode));
      if (iconLibrary === 'lucide') {
        dependencies.push('lucide-vue-next');
      }
      if (typescript) {
        devDependencies.push('@types/node');
      }
      break;
    case 'react':
    case 'nextjs':
      dependencies.push(
        'clsx',
        getTailwindMergeDependency(webTailwindMode),
        '@radix-ui/react-slot',
      );
      devDependencies.push(...getTailwindDevDependencies(webTailwindMode));
      if (iconLibrary === 'lucide') {
        dependencies.push('lucide-react');
      }
      if (typescript) {
        devDependencies.push('@types/react', '@types/react-dom', '@types/node');
      }
      break;
    case 'angular':
      dependencies.push(
        'clsx',
        getTailwindMergeDependency(webTailwindMode),
        '@radix-ng/primitives',
      );
      devDependencies.push(...getTailwindDevDependencies(webTailwindMode));
      if (iconLibrary === 'lucide') {
        dependencies.push('lucide-angular');
      }
      break;
    case 'react-native':
      dependencies.push('clsx', 'class-variance-authority', 'nativewind');
      devDependencies.push(
        'tailwindcss@^3.4.0',
        'babel-plugin-module-resolver',
      );
      break;
    case 'flutter':
      break;
  }

  return {
    dependencies: [...new Set(dependencies)],
    devDependencies: [...new Set(devDependencies)],
  };
}

export { detectExpoProject };
export { configureReactNativeRuntime } from '../utils/init-runtime.js';

export { getUtilsTemplate };
