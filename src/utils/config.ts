import { cosmiconfig } from 'cosmiconfig';
import { resolve } from 'path';
import { writeFile, fileExists } from './files.js';
import { z } from 'zod';

const configSchema = z.object({
  framework: z.enum(['angular', 'react', 'vue']),
  componentsPath: z.string().default('src/components/ui'),
  utilsPath: z.string().default('src/lib/utils.ts'),
  tailwindConfig: z.string().default('tailwind.config.js'),
  aliases: z
    .object({
      components: z.string().default('@/components'),
      utils: z.string().default('@/lib/utils'),
    })
    .optional(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load Galaxy UI configuration
 */
export async function loadConfig(cwd: string): Promise<Config | null> {
  const explorer = cosmiconfig('galaxy', {
    searchPlaces: [
      'galaxy.config.json',
      'galaxy.config.js',
      '.galaxyrc.json',
      '.galaxyrc',
      'package.json',
    ],
  });

  try {
    const result = await explorer.search(cwd);
    if (result && result.config) {
      return configSchema.parse(result.config);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }

  return null;
}

/**
 * Create a new Galaxy UI configuration file
 */
export async function createConfig(cwd: string, config: Config): Promise<void> {
  const configPath = resolve(cwd, 'galaxy.config.json');
  const content = JSON.stringify(config, null, 2);
  writeFile(configPath, content);
}

/**
 * Check if a config file exists
 */
export async function configExists(cwd: string): Promise<boolean> {
  const configFiles = [
    'galaxy.config.json',
    'galaxy.config.js',
    '.galaxyrc.json',
    '.galaxyrc',
  ];

  for (const file of configFiles) {
    if (fileExists(resolve(cwd, file))) {
      return true;
    }
  }

  return false;
}

/**
 * Get default config based on framework
 */
export function getDefaultConfig(framework: 'angular' | 'react' | 'vue'): Config {
  const baseConfig = {
    framework,
    componentsPath: 'src/components/ui',
    utilsPath: 'src/lib/utils.ts',
    tailwindConfig: 'tailwind.config.js',
  };

  switch (framework) {
    case 'angular':
      return {
        ...baseConfig,
        componentsPath: 'src/app/components/ui',
      };
    case 'react':
      return baseConfig;
    case 'vue':
      return baseConfig;
    default:
      return baseConfig;
  }
}
