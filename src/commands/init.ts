import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import {
  detectFramework,
  detectPackageManager,
  type Framework as DetectedFramework,
} from '../utils/detect.js';
import {
  createComponentsConfig,
  hasComponentsConfig,
  loadComponentsConfig,
  type Framework,
} from '../utils/components-config.js';
import {
  getDefaultConfig,
  type BaseColor,
  type IconLibrary,
} from '../utils/config-schema.js';
import { writeFile, ensureDir } from '../utils/files.js';
import { installDependencies } from '../utils/package-manager.js';
import { resolve } from 'path';

interface InitOptions {
  yes?: boolean;
  cwd: string;
}

export async function initCommand(options: InitOptions) {
  console.log(chalk.bold.cyan('\n🌌 Galaxy UI CLI - Multi-Framework Edition\n'));

  const cwd = options.cwd;

  // Check if already initialized
  if (hasComponentsConfig(cwd)) {
    console.log(chalk.yellow('⚠ components.json already exists in this project.'));
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
        '❌ Could not detect framework. Please ensure you are in a valid Angular, React, Vue, Next.js, Nuxt.js, React Native, or Flutter project.'
      )
    );
    return;
  }

  console.log(chalk.green(`✓ Detected ${chalk.bold(detectedFramework)} framework`));

  // Map detected framework to Framework type
  const frameworkMap: Record<DetectedFramework, Framework | null> = {
    angular: 'angular',
    react: 'react',
    vue: 'vue',
    'react-native': 'react-native',
    flutter: 'flutter',
    nextjs: 'nextjs',
    nuxtjs: 'nuxtjs',
    unknown: null,
  };

  const framework = frameworkMap[detectedFramework];
  if (!framework) {
    console.log(chalk.red('❌ Unsupported framework detected.'));
    return;
  }

  // Detect package manager
  const packageManager = detectPackageManager(cwd);
  console.log(chalk.green(`✓ Using ${chalk.bold(packageManager)} package manager`));

  // Get configuration from user (or use defaults with --yes)
  let config = getDefaultConfig(framework);

  if (!options.yes) {
    console.log(chalk.cyan('\n📝 Configuration\n'));

    // Build prompts based on framework
    const promptQuestions: any[] = [];

    // TypeScript prompt (not for Flutter)
    if (framework !== 'flutter') {
      promptQuestions.push({
        type: 'toggle',
        name: 'typescript',
        message: 'Would you like to use TypeScript?',
        initial: true,
        active: 'yes',
        inactive: 'no',
      });
    }

    // Base color prompt (for all frameworks)
    promptQuestions.push({
      type: 'select',
      name: 'baseColor',
      message: 'Which base color would you like to use?',
      choices: [
        { title: 'Slate', value: 'slate' },
        { title: 'Gray', value: 'gray' },
        { title: 'Zinc', value: 'zinc' },
        { title: 'Neutral', value: 'neutral' },
        { title: 'Stone', value: 'stone' },
      ],
      initial: 0,
    });

    // Icon library prompt (not for Flutter - uses built-in icons)
    if (framework !== 'flutter') {
      promptQuestions.push({
        type: 'select',
        name: 'iconLibrary',
        message: 'Which icon library would you like to use?',
        choices: [
          { title: 'Lucide (Recommended)', value: 'lucide' },
          { title: 'Heroicons', value: 'heroicons' },
          { title: 'Radix Icons', value: 'radix-icons' },
        ],
        initial: 0,
      });
    }

    // CSS file prompt (only for web frameworks and React Native)
    if (framework !== 'flutter' && config.tailwind.css) {
      promptQuestions.push({
        type: 'text',
        name: 'cssFile',
        message: framework === 'react-native'
          ? 'Where is your global CSS file (for NativeWind)?'
          : 'Where is your global CSS file?',
        initial: config.tailwind.css,
      });
    }

    const answers = await prompts(promptQuestions);

    if (Object.keys(answers).length === 0) {
      console.log(chalk.gray('Initialization cancelled.'));
      return;
    }

    // Update config with user choices
    config = {
      ...config,
      typescript: answers.typescript ?? config.typescript,
      iconLibrary: (answers.iconLibrary as IconLibrary) ?? config.iconLibrary,
      tailwind: {
        ...config.tailwind,
        baseColor: (answers.baseColor as BaseColor) ?? config.tailwind.baseColor,
        css: answers.cssFile ?? config.tailwind.css,
      },
    };
  }

  console.log(chalk.cyan('\n📦 Installing dependencies...\n'));

  // Install dependencies
  const spinner = ora('Installing dependencies...').start();

  const dependencies: string[] = [];
  const devDependencies: string[] = [];

  // Common dependencies
  dependencies.push('clsx', 'tailwind-merge');

  // Framework-specific dependencies
  switch (framework) {
    case 'vue':
    case 'nuxtjs':
      dependencies.push('radix-vue');
      devDependencies.push('tailwindcss', 'autoprefixer', 'postcss');
      if (config.iconLibrary === 'lucide') {
        dependencies.push('lucide-vue-next');
      }
      break;

    case 'react':
    case 'nextjs':
      dependencies.push('@radix-ui/react-slot');
      devDependencies.push('tailwindcss', 'autoprefixer', 'postcss');
      if (config.iconLibrary === 'lucide') {
        dependencies.push('lucide-react');
      }
      if (config.typescript) {
        devDependencies.push('@types/react', '@types/react-dom');
      }
      break;

    case 'angular':
      // Angular components use Radix NG primitives
      dependencies.push('@radix-ng/primitives');
      if (config.iconLibrary === 'lucide') {
        dependencies.push('lucide-angular');
      }
      break;
  }

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
    return;
  }

  // Create directories
  const dirSpinner = ora('Creating directories...').start();

  try {
    const componentsPath = resolve(cwd, config.aliases.components.replace('@/', ''));
    const utilsPath = resolve(cwd, config.aliases.utils.replace('@/', ''));

    await ensureDir(componentsPath);
    await ensureDir(resolve(componentsPath, 'ui'));
    await ensureDir(utilsPath.replace('/utils', '')); // Create lib dir

    dirSpinner.succeed('Directories created');
  } catch (error) {
    dirSpinner.fail('Failed to create directories');
    console.error(chalk.red(error));
    return;
  }

  // Create utils file
  const utilsSpinner = ora('Creating utility functions...').start();

  try {
    const utilsPath = resolve(cwd, config.aliases.utils.replace('@/', '') + '.ts');
    const utilsContent = getUtilsContent();
    writeFile(utilsPath, utilsContent);

    utilsSpinner.succeed('Utility functions created');
  } catch (error) {
    utilsSpinner.fail('Failed to create utility functions');
    console.error(chalk.red(error));
    return;
  }

  // Save components.json
  const configSpinner = ora('Creating components.json...').start();

  try {
    createComponentsConfig(cwd, framework);
    configSpinner.succeed('components.json created');
  } catch (error) {
    configSpinner.fail('Failed to create components.json');
    console.error(chalk.red(error));
    return;
  }

  // Success message
  console.log(chalk.green('\n✨ Success! Galaxy UI has been initialized.\n'));
  console.log(chalk.cyan('Next steps:\n'));
  console.log(chalk.white(`  1. Configure Tailwind CSS in ${config.tailwind.config}`));
  console.log(chalk.white(`  2. Import utilities in ${config.tailwind.css}`));
  console.log(chalk.white(`  3. Add components:`));
  console.log(chalk.gray(`     galaxy-design add button`));
  console.log(chalk.gray(`     galaxy-design add input card`));
  console.log(chalk.gray(`     galaxy-design add --all\n`));

  console.log(chalk.cyan('Learn more:'));
  console.log(chalk.white('  Documentation: https://galaxy-design.vercel.app'));
  console.log(chalk.white('  GitHub: https://github.com/buikevin/galaxy-design\n'));
}

/**
 * Get utils.ts content
 */
function getUtilsContent(): string {
  return `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}
