import { readFileSync } from 'fs';
import { join } from 'path';
import type { Platform } from './platform-detector';
import { getRegistryFileName } from './platform-detector';

/**
 * Component metadata from registry
 */
export interface ComponentMetadata {
	name: string;
	type: string;
	description: string;
	files: string[];
	dependencies: string[];
	peerDependencies: string[];
	exports: string[];
	selector?: string; // For Angular
}

/**
 * Component group/category
 */
export interface ComponentGroup {
	name: string;
	description?: string;
	components: string[];
}

/**
 * Registry data structure
 */
export interface Registry {
	platform?: string;
	version?: string;
	components: Record<string, ComponentMetadata>;
	groups: Record<string, ComponentGroup>;
}

/**
 * Load registry for specific platform
 *
 * @param platform - Target platform
 * @param registryDir - Directory containing registry files (default: CLI src dir)
 * @returns Registry data
 */
export function loadRegistry(platform: Platform, registryDir?: string): Registry {
	const fileName = getRegistryFileName(platform);
	const registryPath = registryDir
		? join(registryDir, fileName)
		: join(__dirname, '..', fileName);

	try {
		const content = readFileSync(registryPath, 'utf-8');
		const registry = JSON.parse(content) as Registry;
		return registry;
	} catch (error) {
		throw new Error(
			`Failed to load registry for platform "${platform}": ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}

/**
 * Get component metadata from registry
 *
 * @param componentName - Name of component to get
 * @param platform - Target platform
 * @param registryDir - Optional registry directory
 * @returns Component metadata or undefined if not found
 */
export function getComponent(
	componentName: string,
	platform: Platform,
	registryDir?: string,
): ComponentMetadata | undefined {
	const registry = loadRegistry(platform, registryDir);
	return registry.components[componentName];
}

/**
 * List all components for platform
 *
 * @param platform - Target platform
 * @param category - Optional category filter
 * @param registryDir - Optional registry directory
 * @returns Array of component names
 */
export function listComponents(
	platform: Platform,
	category?: string,
	registryDir?: string,
): string[] {
	const registry = loadRegistry(platform, registryDir);

	if (category) {
		// Filter by category
		const components = Object.entries(registry.components)
			.filter(([, meta]) => meta.type === category)
			.map(([name]) => name);
		return components.sort();
	}

	// Return all components
	return Object.keys(registry.components).sort();
}

/**
 * Get all component groups/categories
 *
 * @param platform - Target platform
 * @param registryDir - Optional registry directory
 * @returns Component groups
 */
export function getGroups(platform: Platform, registryDir?: string): Record<string, ComponentGroup> {
	const registry = loadRegistry(platform, registryDir);
	return registry.groups;
}

/**
 * Search components by name or description
 *
 * @param query - Search query
 * @param platform - Target platform
 * @param registryDir - Optional registry directory
 * @returns Array of matching component names
 */
export function searchComponents(
	query: string,
	platform: Platform,
	registryDir?: string,
): Array<{ name: string; relevance: 'high' | 'medium' | 'low' }> {
	const registry = loadRegistry(platform, registryDir);
	const lowerQuery = query.toLowerCase();

	const results = Object.entries(registry.components)
		.map(([name, meta]) => {
			const nameMatch = name.toLowerCase().includes(lowerQuery);
			const descMatch = meta.description.toLowerCase().includes(lowerQuery);
			const typeMatch = meta.type.toLowerCase().includes(lowerQuery);

			let relevance: 'high' | 'medium' | 'low' = 'low';
			if (nameMatch) relevance = 'high';
			else if (typeMatch) relevance = 'medium';
			else if (descMatch) relevance = 'low';

			const isMatch = nameMatch || descMatch || typeMatch;

			return { name, relevance, isMatch };
		})
		.filter((result) => result.isMatch)
		.sort((a, b) => {
			const order = { high: 0, medium: 1, low: 2 };
			return order[a.relevance] - order[b.relevance];
		});

	return results;
}

/**
 * Validate component dependencies
 *
 * Check if all component dependencies are available
 *
 * @param componentName - Component to validate
 * @param platform - Target platform
 * @param registryDir - Optional registry directory
 * @returns Validation result with missing dependencies
 */
export function validateComponentDependencies(
	componentName: string,
	platform: Platform,
	registryDir?: string,
): { valid: boolean; missing: string[] } {
	const component = getComponent(componentName, platform, registryDir);

	if (!component) {
		return { valid: false, missing: [] };
	}

	// Check internal component dependencies
	const missing: string[] = [];
	const registry = loadRegistry(platform, registryDir);

	for (const dep of component.dependencies) {
		if (!registry.components[dep]) {
			missing.push(dep);
		}
	}

	return {
		valid: missing.length === 0,
		missing,
	};
}

/**
 * Get component statistics for platform
 *
 * @param platform - Target platform
 * @param registryDir - Optional registry directory
 * @returns Statistics object
 */
export function getRegistryStats(
	platform: Platform,
	registryDir?: string,
): {
	totalComponents: number;
	groupCounts: Record<string, number>;
	platform: string;
	version: string;
} {
	const registry = loadRegistry(platform, registryDir);

	const groupCounts: Record<string, number> = {};
	for (const [groupName, group] of Object.entries(registry.groups)) {
		groupCounts[groupName] = group.components.length;
	}

	return {
		totalComponents: Object.keys(registry.components).length,
		groupCounts,
		platform: registry.platform || platform,
		version: registry.version || 'unknown',
	};
}
