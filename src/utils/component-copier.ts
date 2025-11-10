import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import type { Platform } from './platform-detector';
import { getComponentSourceDir, isMobilePlatform } from './platform-detector';
import { getComponent, validateComponentDependencies } from './registry-loader';
import {
	fetchAndSaveFile,
	getComponentGitHubPath,
	checkGitHubConnection,
} from './github-fetcher';
import { transformComponent } from './component-transformer';

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
	const component = getComponent(componentName, options.platform, options.registryDir);

	if (!component) {
		result.errors.push(`Component "${componentName}" not found in registry`);
		return result;
	}

	// Validate dependencies
	const validation = validateComponentDependencies(
		componentName,
		options.platform,
		options.registryDir,
	);

	if (!validation.valid) {
		result.errors.push(
			`Missing dependencies: ${validation.missing.join(', ')}. Please add these components first.`,
		);
		return result;
	}

	// Determine target directory based on platform
	const componentsTargetDir = getComponentsTargetDir(options.platform, options.targetDir);

	// Determine source mode: GitHub or local
	const useGitHub = !options.packagesDir;

	// Copy each file
	for (const file of component.files) {
		const targetFile = join(componentsTargetDir, file);

		// Check if target already exists
		if (existsSync(targetFile) && !options.overwrite) {
			result.skipped.push(relative(options.targetDir, targetFile));
			continue;
		}

		// Dry run - don't actually copy
		if (options.dryRun) {
			result.filesCopied.push(relative(options.targetDir, targetFile));
			continue;
		}

		// Create target directory if needed
		const targetDir = dirname(targetFile);
		if (!existsSync(targetDir)) {
			mkdirSync(targetDir, { recursive: true });
		}

		// Copy file - from GitHub or local
		try {
			let fileContent: string;

			if (useGitHub) {
				// Fetch from GitHub
				const githubPath = getComponentGitHubPath(options.platform, componentName, file);
				const success = await fetchAndSaveFile(githubPath, targetFile);

				if (!success) {
					result.errors.push(`Failed to fetch ${file} from GitHub`);
					continue;
				}

				// Read the fetched content for transformation
				fileContent = readFileSync(targetFile, 'utf-8');
			} else {
				// Copy from local packages directory (for development)
				const packagesDir = options.packagesDir!;
				const componentSourceDir = getComponentSourceDir(options.platform);
				const sourceDir = join(packagesDir, componentSourceDir);
				const sourceFile = join(sourceDir, file);

				if (!existsSync(sourceFile)) {
					result.errors.push(`Source file not found: ${sourceFile}`);
					continue;
				}

				fileContent = readFileSync(sourceFile, 'utf-8');
			}

			// Transform component if needed (Next.js, Nuxt.js)
			const transformResult = transformComponent(fileContent, {
				platform: options.platform,
				componentName,
				filePath: targetFile,
			});

			// Write the transformed content
			writeFileSync(targetFile, transformResult.content, 'utf-8');

			// Log transformation notes if modified
			if (transformResult.modified && transformResult.notes.length > 0) {
				// Store notes for later display (optional)
				console.log(`  📝 ${file}: ${transformResult.notes.join(', ')}`);
			}

			result.filesCopied.push(relative(options.targetDir, targetFile));
		} catch (error) {
			result.errors.push(
				`Failed to copy ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	}

	result.success = result.errors.length === 0;
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
function getComponentsTargetDir(platform: Platform, projectRoot: string): string {
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
	const component = getComponent(componentName, platform, options?.registryDir);

	if (!component) {
		return `// Component "${componentName}" not found`;
	}

	const exports = component.exports;

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
		styling: options?.styling || (isMobilePlatform(platform) ? 'styled-components' : 'tailwind'),
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
