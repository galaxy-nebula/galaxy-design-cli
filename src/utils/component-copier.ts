import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join, relative } from 'path';
import type { Platform } from './platform-detector.js';
import {
  getComponentSourceDir,
  isMobilePlatform,
} from './platform-detector.js';
import {
  getFrameworkComponent,
  validateFrameworkComponentDependencies,
} from './framework-registry-service.js';
import {
  fetchFileFromGitHub,
  getComponentGitHubPath,
} from './github-fetcher.js';
import {
  fetchRegistryManifest,
  fetchSourceFromRegistry,
  resolveRegistryUrl,
} from './registry-fetcher.js';
import { transformComponent } from './component-transformer.js';

/**
 * Component copy options
 */
export interface ComponentCopyOptions {
  /** Target directory to copy components to */
  targetDir: string;
  /** Platform to copy for */
  platform: Platform;
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Dry run (don't actually copy) */
  dryRun?: boolean;
  /** Registry directory (for testing) */
  registryDir?: string;
  /** Source packages directory (for testing) */
  packagesDir?: string;
  /** Versioned registry CDN base URL (optional integrity-verified distribution) */
  registryUrl?: string;
}

/**
 * Copy result for a single component
 */
export interface ComponentCopyResult {
  componentName: string;
  success: boolean;
  filesCopied: string[];
  errors: string[];
  skipped: string[];
}

export interface CopyComponentFilesOptions {
  componentName: string;
  componentFiles: string[];
  componentType?: string;
  sourcePlatform: Platform;
  targetPlatform: Platform;
  targetDirectory: string;
  relativeTo: string;
  overwrite?: boolean;
  dryRun?: boolean;
  packagesDir?: string;
  onSkippedFile?: (fileName: string, targetFile: string) => void;
  onTransformedFile?: (fileName: string, notes: string[]) => void;
  /** Versioned registry CDN base URL (optional integrity-verified distribution) */
  registryUrl?: string;
}

export interface CopyComponentFilesResult {
  success: boolean;
  filesCopied: string[];
  errors: string[];
  skipped: string[];
}

function normalizeSourcePlatform(platform: Platform): Platform {
  if (platform === 'nextjs') {
    return 'react';
  }

  if (platform === 'nuxtjs') {
    return 'vue';
  }

  return platform;
}

function normalizeBlockSourceName(
  platform: Platform,
  componentName: string,
): string {
  if (platform === 'react-native' && componentName === 'sidebar') {
    return 'drawer';
  }

  if (platform === 'flutter') {
    if (componentName === 'chat-ui') return 'chat_ui';
    if (componentName === 'sidebar') return 'drawer';
  }

  return componentName;
}

export async function copyComponentFilesToDirectory(
  options: CopyComponentFilesOptions,
): Promise<CopyComponentFilesResult> {
  const result: CopyComponentFilesResult = {
    success: false,
    filesCopied: [],
    errors: [],
    skipped: [],
  };

  const useGitHub = !options.packagesDir;
  const registryUrl = options.registryUrl
    ? resolveRegistryUrl(options.registryUrl)
    : resolveRegistryUrl(undefined);
  const useRegistry = registryUrl !== null;
  let registryManifest: Awaited<
    ReturnType<typeof fetchRegistryManifest>
  > | null = null;
  const writtenFiles: string[] = [];
  const sourcePlatform = normalizeSourcePlatform(options.sourcePlatform);
  const sourceType =
    options.componentType === 'block' ? 'blocks' : 'components';
  const sourceComponentName =
    sourceType === 'blocks'
      ? normalizeBlockSourceName(sourcePlatform, options.componentName)
      : options.componentName;

  for (const file of options.componentFiles) {
    const targetFile = join(options.targetDirectory, file);

    if (existsSync(targetFile) && !options.overwrite) {
      const relativeTarget = relative(options.relativeTo, targetFile);
      result.skipped.push(relativeTarget);
      options.onSkippedFile?.(file, targetFile);
      continue;
    }

    if (options.dryRun) {
      result.filesCopied.push(relative(options.relativeTo, targetFile));
      continue;
    }

    const targetDir = dirname(targetFile);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    try {
      let fileContent: string;

      if (useRegistry) {
        if (!registryManifest) {
          registryManifest = await fetchRegistryManifest(registryUrl!);
        }
        fileContent = await fetchSourceFromRegistry(
          registryUrl!,
          registryManifest,
          sourcePlatform,
          sourceComponentName,
          file,
        );
      } else if (useGitHub) {
        const githubPath = getComponentGitHubPath(
          sourcePlatform,
          sourceComponentName,
          file,
          sourceType,
        );
        fileContent = await fetchFileFromGitHub(githubPath);
      } else {
        const componentSourceDir = getComponentSourceDir(
          sourcePlatform,
        ).replace(/components$/, sourceType);
        const sourceFile = join(
          options.packagesDir!,
          componentSourceDir,
          sourceComponentName,
          file,
        );
        if (!existsSync(sourceFile)) {
          result.errors.push(`${file}: Source file not found: ${sourceFile}`);
          continue;
        }

        fileContent = readFileSync(sourceFile, 'utf-8');
      }

      const transformResult = transformComponent(fileContent, {
        platform: options.targetPlatform,
        componentName: options.componentName,
        filePath: targetFile,
      });

      writeFileSync(targetFile, transformResult.content, 'utf-8');

      if (transformResult.modified && transformResult.notes.length > 0) {
        options.onTransformedFile?.(file, transformResult.notes);
      }

      result.filesCopied.push(relative(options.relativeTo, targetFile));
      writtenFiles.push(targetFile);
    } catch (error) {
      result.errors.push(
        `${file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  if (result.errors.length > 0) {
    for (const writtenFile of writtenFiles) {
      try {
        unlinkSync(writtenFile);
      } catch {
        // Ignore cleanup failures and preserve the original copy errors.
      }
    }

    result.filesCopied = [];
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Copy a component to target project
 *
 * @param componentName - Name of component to copy
 * @param options - Copy options
 * @returns Copy result
 */
export async function copyComponent(
  componentName: string,
  options: ComponentCopyOptions,
): Promise<ComponentCopyResult> {
  const result: ComponentCopyResult = {
    componentName,
    success: false,
    filesCopied: [],
    errors: [],
    skipped: [],
  };

  // Get component metadata
  const component = getFrameworkComponent(options.platform, componentName, {
    registryDir: options.registryDir,
  });

  if (!component) {
    result.errors.push(`Component "${componentName}" not found in registry`);
    return result;
  }

  // Validate dependencies
  const validation = validateFrameworkComponentDependencies(
    options.platform,
    componentName,
    { registryDir: options.registryDir },
  );

  if (!validation.valid) {
    result.errors.push(
      `Missing dependencies: ${validation.missing.join(', ')}. Please add these components first.`,
    );
    return result;
  }

  // Determine target directory based on platform
  const componentsTargetDir = getComponentsTargetDir(
    options.platform,
    options.targetDir,
  );

  const componentTargetDir = join(componentsTargetDir, componentName);
  const copyResult = await copyComponentFilesToDirectory({
    componentName,
    componentFiles: component.files,
    componentType: component.type,
    sourcePlatform: options.platform,
    targetPlatform: options.platform,
    targetDirectory: componentTargetDir,
    relativeTo: options.targetDir,
    overwrite: options.overwrite,
    dryRun: options.dryRun,
    packagesDir: options.packagesDir,
    onTransformedFile: (file, notes) => {
      console.log(`  📝 ${file}: ${notes.join(', ')}`);
    },
  });

  result.filesCopied = copyResult.filesCopied;
  result.errors = copyResult.errors;
  result.skipped = copyResult.skipped;
  result.success = copyResult.success;
  return result;
}

/**
 * Copy multiple components
 *
 * @param componentNames - Array of component names
 * @param options - Copy options
 * @returns Array of copy results
 */
export async function copyComponents(
  componentNames: string[],
  options: ComponentCopyOptions,
): Promise<ComponentCopyResult[]> {
  const results: ComponentCopyResult[] = [];

  for (const name of componentNames) {
    const result = await copyComponent(name, options);
    results.push(result);

    // If this component failed, log warning but continue
    if (!result.success) {
      console.warn(`⚠️  Failed to copy component "${name}"`);
    }
  }

  return results;
}

/**
 * Get components target directory based on platform
 *
 * @param platform - Target platform
 * @param projectRoot - Project root directory
 * @returns Target directory for components
 */
function getComponentsTargetDir(
  platform: Platform,
  projectRoot: string,
): string {
  switch (platform) {
    case 'react-native':
      // React Native: src/components or components
      if (existsSync(join(projectRoot, 'src'))) {
        return join(projectRoot, 'src', 'components');
      }
      return join(projectRoot, 'components');

    case 'flutter':
      // Flutter: lib/components
      return join(projectRoot, 'lib', 'components');

    case 'vue':
    case 'nuxtjs':
      // Vue/Nuxt: src/components or components
      if (existsSync(join(projectRoot, 'src'))) {
        return join(projectRoot, 'src', 'components');
      }
      return join(projectRoot, 'components');

    case 'react':
    case 'nextjs':
      // React/Next.js: src/components or components
      if (existsSync(join(projectRoot, 'src'))) {
        return join(projectRoot, 'src', 'components');
      }
      return join(projectRoot, 'components');

    case 'angular':
      // Angular: src/components or components
      if (existsSync(join(projectRoot, 'src', 'app'))) {
        return join(projectRoot, 'src', 'app', 'components');
      }
      return join(projectRoot, 'components');

    default:
      // Default: components at root
      return join(projectRoot, 'components');
  }
}

/**
 * Generate import statement for component
 *
 * @param componentName - Component name
 * @param platform - Target platform
 * @param options - Options
 * @returns Import statement
 */
export function generateImportStatement(
  componentName: string,
  platform: Platform,
  options?: { registryDir?: string },
): string {
  const component = getFrameworkComponent(platform, componentName, {
    registryDir: options?.registryDir,
  });

  if (!component) {
    return `// Component "${componentName}" not found`;
  }

  const exports = component.exports || [];

  switch (platform) {
    case 'react-native':
    case 'react':
    case 'nextjs':
      // TypeScript/JSX import
      return `import { ${exports.join(', ')} } from '@/components/${componentName}';`;

    case 'flutter':
      // Dart import
      return `import 'package:your_app/components/${componentName}/${componentName.replace(/-/g, '_')}.dart';`;

    case 'vue':
    case 'nuxtjs':
      // Vue import
      return `import { ${exports.join(', ')} } from '@/components/${componentName}';`;

    case 'angular':
      // Angular import
      return `import { ${exports.join(', ')} } from './components/${componentName}';`;

    default:
      return `// Import for platform "${platform}" not supported`;
  }
}

/**
 * Create components.json config file for project
 *
 * @param platform - Target platform
 * @param projectRoot - Project root directory
 * @param options - Additional config options
 */
export function createComponentsConfig(
  platform: Platform,
  projectRoot: string,
  options?: {
    framework?: string;
    typescript?: boolean;
    styling?: 'tailwind' | 'css' | 'styled-components';
  },
): void {
  const config = {
    $schema: 'https://galaxy-design.vercel.app/schema.json',
    platform: platform,
    framework: options?.framework || platform,
    typescript: options?.typescript !== false,
    styling:
      options?.styling ||
      (isMobilePlatform(platform) ? 'styled-components' : 'tailwind'),
    components: getComponentsTargetDir(platform, projectRoot),
    utils: join(projectRoot, isMobilePlatform(platform) ? 'lib' : 'src', 'lib'),
  };

  const configPath = join(projectRoot, 'components.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Read components.json config
 *
 * @param projectRoot - Project root directory
 * @returns Config object or null if not found
 */
export function readComponentsConfig(projectRoot: string): any | null {
  const configPath = join(projectRoot, 'components.json');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read components.json:', error);
    return null;
  }
}
