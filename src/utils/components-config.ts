import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  ComponentsConfig,
  validateConfig,
  getDefaultConfig as getSchemaDefaultConfig,
  type Framework,
} from './config-schema.js';

/**
 * Load components.json config
 */
export function loadComponentsConfig(cwd: string): ComponentsConfig | null {
  const configPath = resolve(cwd, 'components.json');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return validateConfig(config);
  } catch (error) {
    console.error('Error loading components.json:', error);
    return null;
  }
}

/**
 * Save components.json config
 */
export function saveComponentsConfig(cwd: string, config: ComponentsConfig): void {
  const configPath = resolve(cwd, 'components.json');
  const content = JSON.stringify(config, null, 2);
  writeFileSync(configPath, content, 'utf-8');
}

/**
 * Check if components.json exists
 */
export function hasComponentsConfig(cwd: string): boolean {
  return existsSync(resolve(cwd, 'components.json'));
}

/**
 * Create default components.json for a framework
 */
export function createComponentsConfig(cwd: string, framework: Framework): ComponentsConfig {
  const config = getSchemaDefaultConfig(framework);
  saveComponentsConfig(cwd, config);
  return config;
}

/**
 * Get framework from components.json
 */
export function getFrameworkFromConfig(cwd: string): Framework | null {
  const config = loadComponentsConfig(cwd);
  return config?.framework ?? null;
}

/**
 * Update components.json with partial config
 */
export function updateComponentsConfig(
  cwd: string,
  updates: Partial<ComponentsConfig>
): ComponentsConfig | null {
  const existing = loadComponentsConfig(cwd);
  if (!existing) {
    return null;
  }

  const updated = { ...existing, ...updates };
  saveComponentsConfig(cwd, updated);
  return updated;
}
