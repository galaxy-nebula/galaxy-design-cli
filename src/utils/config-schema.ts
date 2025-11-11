import { z } from 'zod';

// Framework types
export const frameworkSchema = z.enum(['vue', 'react', 'angular', 'react-native', 'flutter', 'nextjs', 'nuxtjs']);
export type Framework = z.infer<typeof frameworkSchema>;

// Base color types
export const baseColorSchema = z.enum(['slate', 'gray', 'zinc', 'neutral', 'stone']);
export type BaseColor = z.infer<typeof baseColorSchema>;

// Icon library types
export const iconLibrarySchema = z.enum(['lucide', 'heroicons', 'radix-icons']);
export type IconLibrary = z.infer<typeof iconLibrarySchema>;

// Tailwind configuration
export const tailwindConfigSchema = z.object({
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

// Default configurations per framework
export const defaultConfigs: Record<Framework, Partial<ComponentsConfig>> = {
  vue: {
    framework: 'vue',
    typescript: true,
    tailwind: {
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
    $schema: 'https://galaxy-design.vercel.app/schema.json',
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
          .join('\n')}`
      );
    }
    throw error;
  }
}

/**
 * Get framework-specific file extensions
 */
export function getFileExtensions(framework: Framework, typescript: boolean): string[] {
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
