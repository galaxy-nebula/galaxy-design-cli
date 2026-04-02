import { existsSync, readFileSync } from 'fs';
import prompts from 'prompts';
import { resolve } from 'path';
import {
  detectFramework,
  detectPackageManager,
  hasSrcDirectory,
  type Framework as DetectedFramework,
} from './detect.js';
import {
  getDefaultConfig,
  type BaseColor,
  type ComponentsConfig,
  type Framework,
  type IconLibrary,
} from './config-schema.js';
import {
  detectTailwindVersion,
  resolveTailwindMode,
  type TailwindDetectionResult,
} from './tailwind-detector.js';
import { ensureDir } from './files.js';

export interface InitProjectContext {
  detectedFramework: DetectedFramework;
  framework: Framework;
  packageManager: ReturnType<typeof detectPackageManager>;
  usesSrcDir: boolean;
  isExpoProject: boolean;
  tailwindDetection: TailwindDetectionResult;
  tailwindMode: 'v3' | 'v4' | null;
  config: ComponentsConfig;
}

function mapDetectedFramework(
  detectedFramework: DetectedFramework,
): Framework | null {
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

  return frameworkMap[detectedFramework];
}

export function detectExpoProject(cwd: string): boolean {
  const packageJsonPath = resolve(cwd, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    return Boolean(deps.expo || deps['expo-router']);
  } catch {
    return false;
  }
}

export function resolveInitProjectContext(cwd: string): InitProjectContext {
  const detectedFramework = detectFramework(cwd);
  if (detectedFramework === 'unknown') {
    throw new Error(
      'Could not detect framework. Please ensure you are in a valid Angular, React, Vue, Next.js, Nuxt.js, React Native, or Flutter project.',
    );
  }

  const framework = mapDetectedFramework(detectedFramework);
  if (!framework) {
    throw new Error('Unsupported framework detected.');
  }

  const packageManager = detectPackageManager(cwd);
  const usesSrcDir = hasSrcDirectory(cwd);
  const isExpoProject =
    framework === 'react-native' ? detectExpoProject(cwd) : false;

  let config = getDefaultConfig(framework);

  const tailwindDetection: TailwindDetectionResult =
    framework === 'flutter'
      ? {
          installed: false,
          version: null,
          source: 'unknown',
        }
      : framework === 'react-native'
        ? {
            installed: false,
            version: 3,
            source: 'unknown',
          }
        : detectTailwindVersion(cwd, [config.tailwind.css]);

  const tailwindMode =
    framework === 'flutter'
      ? null
      : framework === 'react-native'
        ? 'v3'
        : resolveTailwindMode(tailwindDetection);

  if (framework !== 'flutter') {
    if (tailwindDetection.cssPath) {
      config = {
        ...config,
        tailwind: {
          ...config.tailwind,
          css: tailwindDetection.cssPath,
        },
      };
    }

    if (tailwindDetection.configPath) {
      config = {
        ...config,
        tailwind: {
          ...config.tailwind,
          config: tailwindDetection.configPath,
        },
      };
    } else if (tailwindMode === 'v4') {
      config = {
        ...config,
        tailwind: {
          ...config.tailwind,
          config: '',
        },
      };
    }

    config = {
      ...config,
      tailwind: {
        ...config.tailwind,
        version: tailwindMode === 'v3' ? 3 : 4,
      },
    };
  }

  return {
    detectedFramework,
    framework,
    packageManager,
    usesSrcDir,
    isExpoProject,
    tailwindDetection,
    tailwindMode,
    config,
  };
}

export function getInitPromptQuestions(
  framework: Framework,
  config: ComponentsConfig,
): prompts.PromptObject[] {
  const promptQuestions: prompts.PromptObject[] = [];

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

  if (framework !== 'flutter' && config.tailwind.css) {
    promptQuestions.push({
      type: 'text',
      name: 'cssFile',
      message:
        framework === 'react-native'
          ? 'Where is your global CSS file (for NativeWind)?'
          : 'Where is your global CSS file?',
      initial: config.tailwind.css,
    });
  }

  return promptQuestions;
}

export function applyInitPromptAnswers(
  config: ComponentsConfig,
  answers: Record<string, unknown>,
): ComponentsConfig {
  return {
    ...config,
    typescript:
      (answers.typescript as boolean | undefined) ?? config.typescript,
    iconLibrary:
      (answers.iconLibrary as IconLibrary | undefined) ?? config.iconLibrary,
    tailwind: {
      ...config.tailwind,
      baseColor:
        (answers.baseColor as BaseColor | undefined) ??
        config.tailwind.baseColor,
      css: (answers.cssFile as string | undefined) ?? config.tailwind.css,
    },
  };
}

export function ensureInitDirectories(
  cwd: string,
  config: ComponentsConfig,
  usesSrcDir: boolean,
): void {
  const baseDir = usesSrcDir ? 'src/' : '';
  const componentsPath = resolve(
    cwd,
    baseDir + config.aliases.components.replace('@/', ''),
  );
  const utilsPath = resolve(
    cwd,
    baseDir + config.aliases.utils.replace('@/', ''),
  );

  ensureDir(componentsPath);
  ensureDir(resolve(componentsPath, 'ui'));
  ensureDir(utilsPath.replace('/utils', ''));
}
