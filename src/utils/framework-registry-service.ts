import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Framework } from './config-schema.js';
import type { Platform } from './platform-detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type RegistryFramework =
  | 'react'
  | 'vue'
  | 'angular'
  | 'react-native'
  | 'flutter';

export type RegistryTarget = Framework | Platform;

export interface FrameworkComponentProvider {
  import: string;
  function: string;
}

export interface FrameworkRegistryComponent {
  name: string;
  type: string;
  description: string;
  files: string[];
  dependencies?: string[];
  devDependencies?: string[];
  peerDependencies?: string[];
  registryDependencies?: string[];
  category?: string;
  exports?: string[];
  selector?: string;
  providers?: FrameworkComponentProvider;
  [key: string]: unknown;
}

export interface FrameworkComponentGroup {
  name: string;
  description?: string;
  components: string[];
}

export interface FrameworkRegistry {
  name: string;
  framework?: RegistryFramework;
  platform?: RegistryFramework;
  version?: string;
  components: Record<string, FrameworkRegistryComponent>;
  groups: Record<string, FrameworkComponentGroup>;
}

const registryCache = new Map<string, FrameworkRegistry>();

function normalizeRegistryTarget(target: RegistryTarget): RegistryFramework {
  switch (target) {
    case 'nextjs':
      return 'react';
    case 'nuxtjs':
      return 'vue';
    case 'react':
    case 'vue':
    case 'angular':
    case 'react-native':
    case 'flutter':
      return target;
    default:
      throw new Error(`Unsupported registry target: ${String(target)}`);
  }
}

function getRegistrySearchPaths(
  framework: RegistryFramework,
  kind: 'registry' | 'blocks' | 'assistant',
  registryDir?: string,
): string[] {
  const fileName = `${kind}-${framework}.json`;

  if (registryDir) {
    return [
      join(registryDir, fileName),
      join(registryDir, 'registries', fileName),
    ];
  }

  return [
    join(__dirname, '..', 'registries', fileName),
    join(__dirname, '..', fileName),
  ];
}

function readRegistryJson(
  framework: RegistryFramework,
  kind: 'registry' | 'blocks' | 'assistant',
  registryDir?: string,
): FrameworkRegistry | null {
  const candidates = getRegistrySearchPaths(framework, kind, registryDir);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const content = readFileSync(candidate, 'utf-8');
    return JSON.parse(content) as FrameworkRegistry;
  }

  return null;
}

export function loadFrameworkRegistry(
  target: RegistryTarget,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): FrameworkRegistry {
  const framework = normalizeRegistryTarget(target);
  const includeBlocks = options?.includeBlocks !== false;
  const includeAssistant = options?.includeBlocks !== false;
  const cacheKey = [framework, options?.registryDir || '', includeBlocks]
    .filter(Boolean)
    .join(':');

  const cached = registryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const registry = readRegistryJson(
    framework,
    'registry',
    options?.registryDir,
  );

  if (!registry) {
    const attemptedPaths = getRegistrySearchPaths(
      framework,
      'registry',
      options?.registryDir,
    );
    throw new Error(
      `Registry not found for ${target}. Looked in: ${attemptedPaths.join(', ')}`,
    );
  }

  const mergedRegistry: FrameworkRegistry = {
    ...registry,
    framework,
    platform: registry.platform || framework,
    components: { ...registry.components },
    groups: { ...registry.groups },
  };

  if (includeBlocks) {
    const blocksRegistry = readRegistryJson(
      framework,
      'blocks',
      options?.registryDir,
    );

    if (blocksRegistry) {
      mergedRegistry.components = {
        ...mergedRegistry.components,
        ...blocksRegistry.components,
      };

      mergedRegistry.groups = {
        ...mergedRegistry.groups,
        ...blocksRegistry.groups,
      };
    }
  }

  if (includeAssistant) {
    const assistantRegistry = readRegistryJson(
      framework,
      'assistant',
      options?.registryDir,
    );

    if (assistantRegistry) {
      mergedRegistry.components = {
        ...mergedRegistry.components,
        ...assistantRegistry.components,
      };

      mergedRegistry.groups = {
        ...mergedRegistry.groups,
        ...assistantRegistry.groups,
      };
    }
  }

  registryCache.set(cacheKey, mergedRegistry);
  return mergedRegistry;
}

export function getFrameworkComponent(
  target: RegistryTarget,
  name: string,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): FrameworkRegistryComponent | undefined {
  return loadFrameworkRegistry(target, options).components[name];
}

export function getAllFrameworkComponents(
  target: RegistryTarget,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): Record<string, FrameworkRegistryComponent> {
  return loadFrameworkRegistry(target, options).components;
}

export function getAllFrameworkGroups(
  target: RegistryTarget,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): Record<string, FrameworkComponentGroup> {
  return loadFrameworkRegistry(target, options).groups;
}

export function frameworkComponentExists(
  target: RegistryTarget,
  name: string,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): boolean {
  return !!getFrameworkComponent(target, name, options);
}

export function getFrameworkComponentsByType(
  target: RegistryTarget,
  type: string,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): FrameworkRegistryComponent[] {
  return Object.values(getAllFrameworkComponents(target, options)).filter(
    (component) => component.type === type,
  );
}

export function getFrameworkComponentsByGroup(
  target: RegistryTarget,
  groupName: string,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): FrameworkRegistryComponent[] {
  const registry = loadFrameworkRegistry(target, options);
  const group = registry.groups[groupName];

  if (!group) {
    return [];
  }

  return group.components
    .map((name) => registry.components[name])
    .filter(Boolean);
}

export function resolveFrameworkComponentName(
  target: RegistryTarget,
  input: string,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): string | null {
  const registry = loadFrameworkRegistry(target, options);

  if (registry.components[input] || registry.groups[input]) {
    return input;
  }

  const lowerInput = input.toLowerCase();
  for (const name of Object.keys(registry.components)) {
    if (name.toLowerCase() === lowerInput) {
      return name;
    }
  }

  for (const name of Object.keys(registry.groups)) {
    if (name.toLowerCase() === lowerInput) {
      return name;
    }
  }

  return null;
}

export function getFrameworkComponentDependencies(
  target: RegistryTarget,
  name: string,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): {
  dependencies: string[];
  devDependencies: string[];
  registryDependencies: string[];
} {
  const component = getFrameworkComponent(target, name, options);

  if (!component) {
    return {
      dependencies: [],
      devDependencies: [],
      registryDependencies: [],
    };
  }

  return {
    dependencies: [
      ...(component.dependencies || []),
      ...(component.peerDependencies || []),
    ],
    devDependencies: component.devDependencies || [],
    registryDependencies: component.registryDependencies || [],
  };
}

export function resolveFrameworkComponentGraph(
  target: RegistryTarget,
  componentNames: string[],
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): string[] {
  const registry = loadFrameworkRegistry(target, options);
  const resolved = new Set<string>();
  const toProcess = [...componentNames];

  while (toProcess.length > 0) {
    const componentName = toProcess.shift();

    if (!componentName || resolved.has(componentName)) {
      continue;
    }

    resolved.add(componentName);

    const dependencies =
      registry.components[componentName]?.registryDependencies || [];
    for (const dependency of dependencies) {
      if (!resolved.has(dependency)) {
        toProcess.push(dependency);
      }
    }
  }

  return Array.from(resolved);
}

export function validateFrameworkComponentDependencies(
  target: RegistryTarget,
  name: string,
  options?: {
    includeBlocks?: boolean;
    registryDir?: string;
  },
): { valid: boolean; missing: string[] } {
  const registry = loadFrameworkRegistry(target, options);
  const component = registry.components[name];

  if (!component) {
    return { valid: false, missing: [] };
  }

  const missing = (component.registryDependencies || []).filter(
    (dependency) => !registry.components[dependency],
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function clearFrameworkRegistryCache(): void {
  registryCache.clear();
}
