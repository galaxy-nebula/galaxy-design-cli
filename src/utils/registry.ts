import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Component {
  name: string;
  selector: string;
  type: 'form' | 'layout' | 'navigation' | 'data-display' | 'modal-overlay' | 'other';
  description: string;
  files: string[];
  dependencies: string[];
  peerDependencies: string[];
  exports: string[];
}

export interface ComponentGroup {
  name: string;
  components: string[];
}

export interface Registry {
  components: Record<string, Component>;
  groups: Record<string, ComponentGroup>;
}

let cachedRegistry: Registry | null = null;

/**
 * Load the component registry
 */
export function loadRegistry(): Registry {
  if (cachedRegistry) {
    return cachedRegistry;
  }

  const registryPath = resolve(__dirname, '../registry.json');
  const registryContent = readFileSync(registryPath, 'utf-8');
  cachedRegistry = JSON.parse(registryContent);
  return cachedRegistry;
}

/**
 * Get a component by name
 */
export function getComponent(name: string): Component | undefined {
  const registry = loadRegistry();
  return registry.components[name];
}

/**
 * Get all components
 */
export function getAllComponents(): Record<string, Component> {
  const registry = loadRegistry();
  return registry.components;
}

/**
 * Get components by type
 */
export function getComponentsByType(type: 'form' | 'layout' | 'navigation' | 'data-display' | 'modal-overlay' | 'other'): Component[] {
  const registry = loadRegistry();
  return Object.values(registry.components).filter(c => c.type === type);
}

/**
 * Get components by group name
 */
export function getComponentsByGroup(groupName: string): Component[] {
  const registry = loadRegistry();
  const group = registry.groups[groupName];

  if (!group) {
    return [];
  }

  return group.components
    .map(name => registry.components[name])
    .filter(Boolean);
}

/**
 * Get all component groups
 */
export function getAllGroups(): Record<string, ComponentGroup> {
  const registry = loadRegistry();
  return registry.groups;
}

/**
 * Check if a component exists
 */
export function componentExists(name: string): boolean {
  const registry = loadRegistry();
  return !!registry.components[name];
}

/**
 * Get component dependencies (including peer dependencies)
 */
export function getComponentDependencies(name: string): string[] {
  const component = getComponent(name);
  if (!component) {
    return [];
  }

  const deps = new Set<string>();

  // Add component dependencies
  component.dependencies.forEach(dep => deps.add(dep));

  return Array.from(deps);
}

/**
 * Resolve component names with aliases
 */
export function resolveComponentName(input: string): string | null {
  const registry = loadRegistry();

  // Check exact match
  if (registry.components[input]) {
    return input;
  }

  // Check group match
  if (registry.groups[input]) {
    return input;
  }

  // Check case-insensitive match
  const lowerInput = input.toLowerCase();
  for (const name of Object.keys(registry.components)) {
    if (name.toLowerCase() === lowerInput) {
      return name;
    }
  }

  return null;
}
