/**
 * P2.2 — Transform lucide icon imports to the user's chosen icon library.
 * Only transforms icons that have a clean 1:1 mapping; others keep using
 * lucide (which is always installed as a fallback).
 */

export type IconLibrary = 'lucide' | 'heroicons' | 'radix-icons';

interface IconMapping {
  packageName: string;
  icons: Record<string, string>;
}

const LUCIDE_TO_HEROICONS: Record<string, string> = {
  Check: 'CheckIcon',
  ChevronDown: 'ChevronDownIcon',
  ChevronLeft: 'ChevronLeftIcon',
  ChevronRight: 'ChevronRightIcon',
  Search: 'MagnifyingGlassIcon',
  Calendar: 'CalendarIcon',
  Clock: 'ClockIcon',
  X: 'XMarkIcon',
  MoreHorizontal: 'EllipsisHorizontalIcon',
};

const LUCIDE_TO_RADIX: Record<string, string> = {
  Check: 'CheckIcon',
  ChevronDown: 'ChevronDownIcon',
  ChevronLeft: 'ChevronLeftIcon',
  ChevronRight: 'ChevronRightIcon',
  X: 'Cross1Icon',
  Search: 'MagnifyingGlassIcon',
  Calendar: 'CalendarIcon',
  Clock: 'ClockIcon',
};

const FRAMEWORK_LUCIDE_PACKAGES: Record<string, string> = {
  react: 'lucide-react',
  nextjs: 'lucide-react',
  vue: 'lucide-vue-next',
  nuxtjs: 'lucide-vue-next',
  angular: 'lucide-angular',
};

const ICON_LIBRARY_PACKAGES: Record<string, Record<string, string>> = {
  heroicons: {
    react: '@heroicons/react/24/outline',
    nextjs: '@heroicons/react/24/outline',
    vue: '@heroicons/vue/24/outline',
    nuxtjs: '@heroicons/vue/24/outline',
  },
  'radix-icons': {
    react: '@radix-ui/react-icons',
    nextjs: '@radix-ui/react-icons',
    vue: '@radix-ui/react-icons',
    nuxtjs: '@radix-ui/react-icons',
  },
};

const MAPPINGS: Partial<Record<IconLibrary, IconMapping>> = {
  heroicons: {
    packageName: '@heroicons',
    icons: LUCIDE_TO_HEROICONS,
  },
  'radix-icons': {
    packageName: 'radix',
    icons: LUCIDE_TO_RADIX,
  },
};

export function getTargetIconPackage(framework: string, iconLibrary: string): string | null {
  if (iconLibrary === 'lucide') return null;
  return ICON_LIBRARY_PACKAGES[iconLibrary]?.[framework] ?? null;
}

export function transformIconImports(
  content: string,
  framework: string,
  iconLibrary: string,
): { content: string; transformed: boolean } {
  const mapping = MAPPINGS[iconLibrary as IconLibrary];
  if (!mapping) return { content, transformed: false };

  const lucidePackage = FRAMEWORK_LUCIDE_PACKAGES[framework];
  if (!lucidePackage) return { content, transformed: false };

  // Find all lucide import statements
  const importRegex = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${lucidePackage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
    'g',
  );

  let hasLucideImports = false;
  let transformedContent = content.replace(
    importRegex,
    (match, iconNames: string) => {
      hasLucideImports = true;
      const names = iconNames
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);

      const mapped = names
        .map((name) => {
          // handle "X as Y" aliases
          const aliasMatch = name.match(/(\w+)\s+as\s+(\w+)/);
          if (aliasMatch) return name; // keep aliases as-is
          return mapping.icons[name] || name;
        })
        .join(', ');

      const iconPackage = getTargetIconPackage(framework, iconLibrary);
      if (!iconPackage) return match;
      return `import { ${mapped} } from '${iconPackage}'`;
    },
  );

  if (!hasLucideImports) return { content, transformed: false };

  return { content: transformedContent, transformed: true };
}
