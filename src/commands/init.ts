import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import {
  detectFramework,
  detectPackageManager,
  hasSrcDirectory,
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
import { writeFile, ensureDir, readFile } from '../utils/files.js';
import { installDependencies } from '../utils/package-manager.js';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

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

  // Detect if project uses src/ directory and adjust paths accordingly
  const usesSrcDir = hasSrcDirectory(cwd);
  if (usesSrcDir) {
    console.log(chalk.green(`✓ Detected ${chalk.bold('src/')} directory structure`));
  }

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
      devDependencies.push('tailwindcss@3.4.0', 'autoprefixer', 'postcss');
      if (config.iconLibrary === 'lucide') {
        dependencies.push('lucide-vue-next');
      }
      if (config.typescript) {
        devDependencies.push('@types/node');
      }
      break;

    case 'react':
    case 'nextjs':
      dependencies.push('@radix-ui/react-slot');
      devDependencies.push('tailwindcss@3.4.0', 'autoprefixer', 'postcss');
      if (config.iconLibrary === 'lucide') {
        dependencies.push('lucide-react');
      }
      if (config.typescript) {
        devDependencies.push('@types/react', '@types/react-dom', '@types/node');
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
    const baseDir = usesSrcDir ? 'src/' : '';
    const componentsPath = resolve(cwd, baseDir + config.aliases.components.replace('@/', ''));
    const utilsPath = resolve(cwd, baseDir + config.aliases.utils.replace('@/', ''));

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
    const baseDir = usesSrcDir ? 'src/' : '';
    const utilsPath = resolve(cwd, baseDir + config.aliases.utils.replace('@/', '') + '.ts');
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

  // Create Tailwind CSS configuration files (only for frameworks that use Tailwind)
  if (framework !== 'flutter' && framework !== 'angular') {
    const tailwindSpinner = ora('Creating Tailwind CSS configuration...').start();

    try {
      // Create tailwind.config.js
      const tailwindConfigPath = resolve(cwd, config.tailwind.config);
      const tailwindConfigContent = getTailwindConfigContent(framework);
      writeFile(tailwindConfigPath, tailwindConfigContent);

      // Create postcss.config.js
      const postcssConfigPath = resolve(cwd, 'postcss.config.js');
      const postcssConfigContent = getPostCSSConfigContent();
      writeFile(postcssConfigPath, postcssConfigContent);

      tailwindSpinner.succeed('Tailwind CSS configuration created');
    } catch (error) {
      tailwindSpinner.fail('Failed to create Tailwind CSS configuration');
      console.error(chalk.red(error));
      return;
    }

    // Create or update CSS file with Tailwind directives
    const cssSpinner = ora('Setting up CSS file...').start();

    try {
      const baseDir = usesSrcDir ? 'src/' : '';
      const cssPath = resolve(cwd, baseDir + config.tailwind.css.replace('src/', ''));
      const cssContent = getCSSContent(config.tailwind.baseColor);
      writeFile(cssPath, cssContent);

      cssSpinner.succeed('CSS file configured');
    } catch (error) {
      cssSpinner.fail('Failed to configure CSS file');
      console.error(chalk.red(error));
      return;
    }
  }

  // Configure path aliases for TypeScript and bundler
  if (config.typescript && framework !== 'flutter' && framework !== 'angular') {
    const aliasSpinner = ora('Configuring path aliases...').start();

    try {
      // Configure TypeScript path aliases
      if (framework === 'react') {
        // Vite React uses tsconfig.app.json
        configureTypeScriptAliases(cwd, 'tsconfig.app.json', usesSrcDir);
      } else if (framework === 'vue' || framework === 'nextjs') {
        // Vue and Next.js use tsconfig.json
        configureTypeScriptAliases(cwd, 'tsconfig.json', usesSrcDir);
      }

      // Configure bundler path aliases (only for Vite projects, not Next.js/Nuxt)
      if (framework === 'react') {
        configureViteAliases(cwd, 'vite.config.ts');
      } else if (framework === 'vue') {
        configureViteAliases(cwd, 'vite.config.js');
      }

      aliasSpinner.succeed('Path aliases configured');
    } catch (error) {
      aliasSpinner.fail('Failed to configure path aliases');
      console.error(chalk.red(error));
      // Don't return - this is not critical
    }
  }

  // Success message
  console.log(chalk.green('\n✨ Success! Galaxy UI has been initialized.\n'));
  console.log(chalk.cyan('Next steps:\n'));
  console.log(chalk.white(`  1. Add components:`));
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

/**
 * Get tailwind.config.js content
 */
function getTailwindConfigContent(framework: Framework): string {
  const contentPaths =
    framework === 'react' || framework === 'nextjs'
      ? `[
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ]`
      : framework === 'vue' || framework === 'nuxtjs'
      ? `[
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ]`
      : `[
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ]`;

  return `/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ${contentPaths},
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
`;
}

/**
 * Get postcss.config.js content
 */
function getPostCSSConfigContent(): string {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
}

/**
 * Get CSS file content with Tailwind directives and CSS variables
 */
function getCSSContent(baseColor: BaseColor): string {
  // CSS variables based on base color
  const colorVariables: Record<BaseColor, { light: string; dark: string }> = {
    slate: {
      light: `--background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;`,
      dark: `--background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;`,
    },
    gray: {
      light: `--background: 0 0% 100%;
    --foreground: 224 71.4% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 224 71.4% 4.1%;
    --popover: 0 0% 100%;
    --popover-foreground: 224 71.4% 4.1%;
    --primary: 220.9 39.3% 11%;
    --primary-foreground: 210 20% 98%;
    --secondary: 220 14.3% 95.9%;
    --secondary-foreground: 220.9 39.3% 11%;
    --muted: 220 14.3% 95.9%;
    --muted-foreground: 220 8.9% 46.1%;
    --accent: 220 14.3% 95.9%;
    --accent-foreground: 220.9 39.3% 11%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 20% 98%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 224 71.4% 4.1%;
    --radius: 0.5rem;`,
      dark: `--background: 224 71.4% 4.1%;
    --foreground: 210 20% 98%;
    --card: 224 71.4% 4.1%;
    --card-foreground: 210 20% 98%;
    --popover: 224 71.4% 4.1%;
    --popover-foreground: 210 20% 98%;
    --primary: 210 20% 98%;
    --primary-foreground: 220.9 39.3% 11%;
    --secondary: 215 27.9% 16.9%;
    --secondary-foreground: 210 20% 98%;
    --muted: 215 27.9% 16.9%;
    --muted-foreground: 217.9 10.6% 64.9%;
    --accent: 215 27.9% 16.9%;
    --accent-foreground: 210 20% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 20% 98%;
    --border: 215 27.9% 16.9%;
    --input: 215 27.9% 16.9%;
    --ring: 216 12.2% 83.9%;`,
    },
    zinc: {
      light: `--background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 10% 3.9%;
    --radius: 0.5rem;`,
      dark: `--background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;`,
    },
    neutral: {
      light: `--background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --radius: 0.5rem;`,
      dark: `--background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;`,
    },
    stone: {
      light: `--background: 0 0% 100%;
    --foreground: 20 14.3% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 20 14.3% 4.1%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 14.3% 4.1%;
    --primary: 24 9.8% 10%;
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 60 4.8% 95.9%;
    --secondary-foreground: 24 9.8% 10%;
    --muted: 60 4.8% 95.9%;
    --muted-foreground: 25 5.3% 44.7%;
    --accent: 60 4.8% 95.9%;
    --accent-foreground: 24 9.8% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 20 5.9% 90%;
    --input: 20 5.9% 90%;
    --ring: 20 14.3% 4.1%;
    --radius: 0.5rem;`,
      dark: `--background: 20 14.3% 4.1%;
    --foreground: 60 9.1% 97.8%;
    --card: 20 14.3% 4.1%;
    --card-foreground: 60 9.1% 97.8%;
    --popover: 20 14.3% 4.1%;
    --popover-foreground: 60 9.1% 97.8%;
    --primary: 60 9.1% 97.8%;
    --primary-foreground: 24 9.8% 10%;
    --secondary: 12 6.5% 15.1%;
    --secondary-foreground: 60 9.1% 97.8%;
    --muted: 12 6.5% 15.1%;
    --muted-foreground: 24 5.4% 63.9%;
    --accent: 12 6.5% 15.1%;
    --accent-foreground: 60 9.1% 97.8%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 12 6.5% 15.1%;
    --input: 12 6.5% 15.1%;
    --ring: 24 5.7% 82.9%;`,
    },
  };

  const colors = colorVariables[baseColor];

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    ${colors.light}
  }

  .dark {
    ${colors.dark}
  }
}
`;
}

/**
 * Configure TypeScript path aliases in tsconfig
 */
function configureTypeScriptAliases(cwd: string, tsconfigFile: string, usesSrcDir: boolean): void {
  const tsconfigPath = resolve(cwd, tsconfigFile);

  if (!existsSync(tsconfigPath)) {
    return;
  }

  try {
    let content = readFileSync(tsconfigPath, 'utf-8');

    // Determine the correct path based on project structure
    const pathMapping = usesSrcDir ? './src/*' : './*';

    // Check if paths already exists in compilerOptions - skip to avoid duplicates
    // Match "compilerOptions" followed by anything, then "paths" within the compilerOptions object
    const compilerOptionsMatch = content.match(/"compilerOptions"\s*:\s*\{([\s\S]*?)^\s*\}/m);
    if (!compilerOptionsMatch) {
      throw new Error('compilerOptions not found');
    }

    // Check if paths already exists in the compilerOptions
    if (compilerOptionsMatch[1].includes('"paths"')) {
      return; // Paths already configured, skip to avoid duplicates
    }

    // Strategy: Insert before the closing } of compilerOptions
    // Find the pattern: any content followed by closing brace and comma (or newline), followed by "include" or other root property
    const insertPattern = /(\s*)(}\s*,?\s*\n\s*"(?:include|exclude|extends|files|references))/;
    const match = content.match(insertPattern);

    if (match) {
      const indent = match[1] || '    ';
      // Insert path config before the closing brace
      const pathConfig = `,\n\n${indent}/* Path Aliases */\n${indent}"baseUrl": ".",\n${indent}"paths": {\n${indent}  "@/*": ["${pathMapping}"]\n${indent}}`;

      content = content.replace(insertPattern, `${pathConfig}\n$1$2`);
      writeFileSync(tsconfigPath, content, 'utf-8');
    }
  } catch (error) {
    // Silently fail - path aliases are not critical
  }
}

/**
 * Configure Vite path aliases in vite.config
 */
function configureViteAliases(cwd: string, viteConfigFile: string): void {
  const viteConfigPath = resolve(cwd, viteConfigFile);

  if (!existsSync(viteConfigPath)) {
    return;
  }

  try {
    let content = readFileSync(viteConfigPath, 'utf-8');

    // Check if path is already imported
    if (!content.includes("import path from 'path'") && !content.includes('import path from "path"')) {
      // Add path import after the first import line
      content = content.replace(
        /(import .+ from .+\n)/,
        "$1import path from 'path'\n"
      );
    }

    // Check if resolve.alias is already configured
    if (!content.includes('resolve:') && !content.includes('@:')) {
      // Add resolve.alias configuration
      content = content.replace(
        /(plugins: \[.+\],?)/s,
        `$1\n  resolve: {\n    alias: {\n      '@': path.resolve(__dirname, './src'),\n    },\n  },`
      );
    }

    writeFileSync(viteConfigPath, content, 'utf-8');
  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not update ${viteConfigFile}`));
  }
}
