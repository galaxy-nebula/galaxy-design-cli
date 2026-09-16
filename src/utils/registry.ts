import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type SummaryFramework =
  | 'react'
  | 'nextjs'
  | 'vue'
  | 'nuxtjs'
  | 'angular'
  | 'react-native'
  | 'flutter';

export interface SummaryProp {
  name: string;
  type: unknown;
  default?: unknown;
  description?: string;
  frameworks?: SummaryFramework[];
  overrides?: Record<string, unknown>;
}

export interface SummaryChildComponent {
  name: string;
  props: SummaryProp[];
}

export interface Component {
  name: string;
  type:
    | 'form'
    | 'layout'
    | 'navigation'
    | 'feedback'
    | 'data-display'
    | 'modal-overlay'
    | 'interactive'
    | 'charts'
    | 'block'
    | 'other';
  description: string;
  category: string;
  frameworks: SummaryFramework[];
  props?: SummaryProp[];
  children?: SummaryChildComponent[];
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
  const registry = JSON.parse(registryContent) as Registry;
  cachedRegistry = registry;
  return registry;
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
export function getComponentsByType(type: Component['type']): Component[] {
  const registry = loadRegistry();
  return Object.values(registry.components).filter(c => c.type === type);
}

/**
 * Get components that support a specific framework
 */
export function getComponentsByFramework(framework: SummaryFramework): Component[] {
  const registry = loadRegistry();
  return Object.values(registry.components).filter((component) =>
    component.frameworks.includes(framework),
  );
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
  void name;
  return [];
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
