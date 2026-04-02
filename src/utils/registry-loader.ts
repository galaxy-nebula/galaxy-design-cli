import type { Platform } from './platform-detector.js';
import {
  getAllFrameworkGroups,
  getAllFrameworkComponents,
  getFrameworkComponent,
  getFrameworkComponentsByType,
  loadFrameworkRegistry,
  validateFrameworkComponentDependencies,
  type FrameworkComponentGroup as ComponentGroup,
  type FrameworkRegistry as Registry,
  type FrameworkRegistryComponent as ComponentMetadata,
} from './framework-registry-service.js';

/**
 * Component metadata from registry
 */
/**
 * Load registry for specific platform
 *
 * @param platform - Target platform
 * @param registryDir - Directory containing registry files (default: CLI src dir)
 * @returns Registry data
 */
export function loadRegistry(
  platform: Platform,
  registryDir?: string,
): Registry {
  return loadFrameworkRegistry(platform, { registryDir });
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
  return getFrameworkComponent(platform, componentName, { registryDir });
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
  const components = getAllFrameworkComponents(platform, { registryDir });

  if (category) {
    return Object.entries(components)
      .filter(([, meta]) => meta.type === category)
      .map(([name]) => name)
      .sort();
  }

  return Object.keys(components).sort();
}

/**
 * Get all component groups/categories
 *
 * @param platform - Target platform
 * @param registryDir - Optional registry directory
 * @returns Component groups
 */
export function getGroups(
  platform: Platform,
  registryDir?: string,
): Record<string, ComponentGroup> {
  return getAllFrameworkGroups(platform, { registryDir });
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
  return validateFrameworkComponentDependencies(platform, componentName, {
    registryDir,
  });
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
