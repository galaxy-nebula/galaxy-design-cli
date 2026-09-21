import { z } from 'zod';

export const frameworkValues = [
  'vue',
  'react',
  'angular',
  'react-native',
  'flutter',
  'nextjs',
  'nuxtjs',
] as const;

// Framework types
export const frameworkSchema = z.enum(frameworkValues);
export type Framework = z.infer<typeof frameworkSchema>;

export const baseColorValues = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
] as const;

// Base color types
export const baseColorSchema = z.enum(baseColorValues);
export type BaseColor = z.infer<typeof baseColorSchema>;

export const iconLibraryValues = [
  'lucide',
  'heroicons',
  'radix-icons',
] as const;

// Icon library types
export const iconLibrarySchema = z.enum(iconLibraryValues);
export type IconLibrary = z.infer<typeof iconLibrarySchema>;

export interface JsonSchemaObject {
  [key: string]: JsonSchemaValue;
}

export type JsonSchemaValue =
  | string
  | number
  | boolean
  | null
  | JsonSchemaObject
  | JsonSchemaValue[];

export const tailwindVersionSchema = z
  .union([z.literal(3), z.literal(4)])
  .nullable();
export type TailwindVersion = z.infer<typeof tailwindVersionSchema>;

// Tailwind configuration
export const tailwindConfigSchema = z.object({
  version: tailwindVersionSchema.optional(),
  config: z.string().default('tailwind.config.js'),
  css: z.string(),
  baseColor: baseColorSchema.default('slate'),
  cssVariables: z.boolean().default(true),
  prefix: z.string().optional().default(''),
});
export type TailwindConfig = z.infer<typeof tailwindConfigSchema>;

// Aliases configuration
export const aliasesSchema = z.object({
  components: z.string(),
  utils: z.string(),
  ui: z.string().optional(),
  lib: z.string().optional(),
});
export type Aliases = z.infer<typeof aliasesSchema>;

// Main components.json schema
export const componentsConfigSchema = z.object({
  $schema: z.string().optional(),
  framework: frameworkSchema,
  typescript: z.boolean().default(true),
  tailwind: tailwindConfigSchema,
  aliases: aliasesSchema,
  iconLibrary: iconLibrarySchema.default('lucide'),
});
export type ComponentsConfig = z.infer<typeof componentsConfigSchema>;

export function createComponentsJsonSchema(): JsonSchemaObject {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Galaxy UI Configuration',
    description: 'Configuration file for Galaxy UI components',
    type: 'object',
    required: ['framework', 'typescript', 'tailwind', 'aliases'],
    properties: {
      $schema: {
        type: 'string',
        description: 'Path to the schema file',
      },
      framework: {
        type: 'string',
        enum: [...frameworkValues],
        description: 'The framework used in the project',
      },
      typescript: {
        type: 'boolean',
        description: 'Whether TypeScript is used',
        default: true,
      },
      tailwind: {
        type: 'object',
        required: ['config', 'css'],
        properties: {
          version: {
            type: ['integer', 'null'],
            enum: [3, 4, null],
            description: 'Detected or selected Tailwind major version',
          },
          config: {
            type: 'string',
            description:
              'Path to the Tailwind configuration file. May be empty when using Tailwind v4 CSS-first setup.',
            default: 'tailwind.config.js',
          },
          css: {
            type: 'string',
            description: 'Path to the global CSS file',
            examples: [
              'src/styles/globals.css',
              'src/assets/styles/global.css',
              'src/app/globals.css',
            ],
          },
          baseColor: {
            type: 'string',
            description: 'Base color for components',
            enum: [...baseColorValues],
            default: 'slate',
          },
          cssVariables: {
            type: 'boolean',
            description: 'Use CSS variables for theming',
            default: true,
          },
          prefix: {
            type: 'string',
            description: 'Prefix for Tailwind utility classes',
            default: '',
          },
        },
      },
      aliases: {
        type: 'object',
        required: ['components', 'utils'],
        properties: {
          components: {
            type: 'string',
            description: 'Import alias for components directory',
            examples: ['@/components', '~/components', 'src/components'],
          },
          utils: {
            type: 'string',
            description: 'Import alias for utils directory',
            examples: ['@/lib/utils', '@/utils', '~/lib/utils'],
          },
          ui: {
            type: 'string',
            description: 'Import alias for UI components directory',
            examples: ['@/components/ui', '~/components/ui'],
          },
          lib: {
            type: 'string',
            description: 'Import alias for lib directory',
            examples: ['@/lib', '~/lib'],
          },
        },
      },
      iconLibrary: {
        type: 'string',
        enum: [...iconLibraryValues],
        description: 'Icon library to use',
        default: 'lucide',
      },
    },
  };
}

// Default configurations per framework
export const defaultConfigs: Record<Framework, Partial<ComponentsConfig>> = {
  vue: {
    framework: 'vue',
    typescript: true,
    tailwind: {
      version: 4,
      config: 'tailwind.config.js',
      css: 'src/style.css',
      baseColor: 'slate',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
      lib: '@/lib',
    },
    iconLibrary: 'lucide',
  },
  react: {
    framework: 'react',
    typescript: true,
    tailwind: {
      version: 4,
      config: 'tailwind.config.js',
      css: 'src/index.css',
      baseColor: 'slate',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
      lib: '@/lib',
    },
    iconLibrary: 'lucide',
  },
  angular: {
    framework: 'angular',
    typescript: true,
    tailwind: {
      version: 4,
      config: 'tailwind.config.js',
      css: 'src/styles.css',
      baseColor: 'slate',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
      lib: '@/lib',
    },
    iconLibrary: 'lucide',
  },
  'react-native': {
    framework: 'react-native',
    typescript: true,
    tailwind: {
      version: 4,
      config: 'tailwind.config.js',
      css: 'global.css',
      baseColor: 'slate',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
      lib: '@/lib',
    },
    iconLibrary: 'lucide',
  },
  flutter: {
    framework: 'flutter',
    typescript: false, // Flutter uses Dart
    tailwind: {
      version: null,
      config: '', // Flutter doesn't use Tailwind
      css: '',
      baseColor: 'slate',
      cssVariables: false,
      prefix: '',
    },
    aliases: {
      components: 'lib/components',
      utils: 'lib/utils',
      ui: 'lib/components/ui',
      lib: 'lib',
    },
    iconLibrary: 'lucide',
  },
  nextjs: {
    framework: 'nextjs',
    typescript: true,
    tailwind: {
      version: 4,
      config: 'tailwind.config.ts',
      css: 'app/globals.css', // Next.js App Router
      baseColor: 'slate',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
      lib: '@/lib',
    },
    iconLibrary: 'lucide',
  },
  nuxtjs: {
    framework: 'nuxtjs',
    typescript: true,
    tailwind: {
      version: 4,
      config: 'tailwind.config.js',
      css: 'assets/css/main.css', // Nuxt 3 default
      baseColor: 'slate',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      utils: '@/lib/utils',
      ui: '@/components/ui',
      lib: '@/lib',
    },
    iconLibrary: 'lucide',
  },
};

/**
 * Get default config for a framework
 */
export function getDefaultConfig(framework: Framework): ComponentsConfig {
  const defaults = defaultConfigs[framework];
  return {
    $schema: 'https://galaxy-nebula.vercel.app/schema.json',
    ...defaults,
  } as ComponentsConfig;
}

/**
 * Validate components.json config
 */
export function validateConfig(config: unknown): ComponentsConfig {
  try {
    return componentsConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid components.json configuration:\n${error.issues
          .map((e: z.ZodIssue) => `  - ${e.path.join('.')}: ${e.message}`)
          .join('\n')}`,
      );
    }
    throw error;
  }
}

/**
 * Get framework-specific file extensions
 */
export function getFileExtensions(
  framework: Framework,
  typescript: boolean,
): string[] {
  const ext = typescript ? 'ts' : 'js';

  switch (framework) {
    case 'vue':
    case 'nuxtjs':
      return ['.vue', `.${ext}`];
    case 'react':
    case 'nextjs':
      return [`.tsx`, `.jsx`, `.${ext}`];
    case 'react-native':
      return [`.tsx`, `.jsx`, `.native.${ext}`, `.${ext}`];
    case 'angular':
      return [`.component.ts`, `.service.ts`, `.directive.ts`, `.${ext}`];
    case 'flutter':
      return ['.dart'];
    default:
      return [`.${ext}`];
  }
}

/**
 * Get framework-specific component path patterns
 */
export function getComponentPath(framework: Framework): string {
  switch (framework) {
    case 'vue':
    case 'nuxtjs':
      return 'src/components';
    case 'react':
    case 'nextjs':
      return 'src/components';
    case 'react-native':
      return 'src/components';
    case 'angular':
      return 'src/app/components';
    case 'flutter':
      return 'lib/components';
    default:
      return 'src/components';
  }
}
