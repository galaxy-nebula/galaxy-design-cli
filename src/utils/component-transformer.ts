import { readFileSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import type { Platform } from './platform-detector.js';

/**
 * Transform options for component files
 */
export interface TransformOptions {
  /** Target platform */
  platform: Platform;
  /** Component name */
  componentName: string;
  /** File path */
  filePath: string;
}

/**
 * Transform result
 */
export interface TransformResult {
  /** Transformed content */
  content: string;
  /** Whether content was modified */
  modified: boolean;
  /** Transformation notes */
  notes: string[];
}

/**
 * Check if a React/Next.js component needs 'use client' directive
 *
 * Components need 'use client' if they use:
 * - React hooks (useState, useEffect, etc.)
 * - Event handlers (onClick, onChange, etc.)
 * - Browser APIs (window, document, etc.)
 * - Client-side libraries
 */
function needsUseClient(content: string): boolean {
  const clientIndicators = [
    // React hooks
    /\buse[A-Z]\w+\s*\(/,
    /useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef/,

    // Event handlers
    /\bon[A-Z]\w+\s*=/,
    /onClick|onChange|onSubmit|onFocus|onBlur|onKeyDown|onKeyUp|onMouseEnter|onMouseLeave/,

    // Browser APIs
    /\bwindow\./,
    /\bdocument\./,
    /\bnavigator\./,
    /\blocalStorage\./,
    /\bsessionStorage\./,

    // Client-side only features
    /addEventListener/,
    /removeEventListener/,
    /createPortal/,
  ];

  return clientIndicators.some((indicator) => indicator.test(content));
}

/**
 * Check if file already has 'use client' directive
 */
function hasUseClientDirective(content: string): boolean {
  const lines = content.split('\n');
  const firstNonEmptyLine = lines.find((line) => line.trim() !== '');
  return (
    firstNonEmptyLine?.trim().startsWith("'use client'") ||
    firstNonEmptyLine?.trim().startsWith('"use client"') ||
    false
  );
}

function getDirectiveInsertionIndex(content: string): number {
  let index = 0;

  if (content.startsWith('#!')) {
    const shebangEnd = content.indexOf('\n');
    index = shebangEnd === -1 ? content.length : shebangEnd + 1;
  }

  while (index < content.length) {
    const remaining = content.slice(index);

    const whitespaceMatch = remaining.match(/^[\t\r\n ]+/);
    if (whitespaceMatch) {
      index += whitespaceMatch[0].length;
      continue;
    }

    if (remaining.startsWith('//')) {
      const lineEnd = remaining.indexOf('\n');
      index += lineEnd === -1 ? remaining.length : lineEnd + 1;
      continue;
    }

    if (remaining.startsWith('/*')) {
      const commentEnd = remaining.indexOf('*/');
      if (commentEnd === -1) {
        return index;
      }

      index += commentEnd + 2;
      continue;
    }

    break;
  }

  return index;
}

/**
 * Add 'use client' directive to Next.js component
 */
function addUseClientDirective(content: string): string {
  // Skip if already has the directive
  if (hasUseClientDirective(content)) {
    return content;
  }

  const insertIndex = getDirectiveInsertionIndex(content);
  const prefix = content.slice(0, insertIndex).trimEnd();
  const suffix = content.slice(insertIndex).trimStart();

  if (!prefix) {
    return `'use client'\n\n${suffix}`;
  }

  return `${prefix}\n\n'use client'\n\n${suffix}`;
}

/**
 * Transform component for Next.js
 *
 * Adds 'use client' directive if component uses client-side features
 */
function transformNextjsComponent(
  content: string,
  componentName: string,
): TransformResult {
  const notes: string[] = [];
  let modified = false;
  let transformedContent = content;

  // Check if component needs 'use client'
  if (needsUseClient(content) && !hasUseClientDirective(content)) {
    transformedContent = addUseClientDirective(content);
    modified = true;
    notes.push(
      `Added 'use client' directive (component uses client-side features)`,
    );
  } else if (hasUseClientDirective(content)) {
    notes.push(`Component already has 'use client' directive`);
  } else {
    notes.push(`Component appears to be server-safe (no 'use client' needed)`);
  }

  return {
    content: transformedContent,
    modified,
    notes,
  };
}

/**
 * Transform component for Nuxt.js
 *
 * Currently no transformations needed, but placeholder for future enhancements
 */
function transformNuxtjsComponent(
  content: string,
  componentName: string,
): TransformResult {
  const notes: string[] = [];

  // Check for Nuxt-specific patterns
  const hasNuxtImports = /from ['"]#app['"]/.test(content);
  const hasAutoImports = /\b(navigateTo|useFetch|useAsyncData|useState)\b/.test(
    content,
  );

  if (hasNuxtImports) {
    notes.push('Component uses Nuxt 3 auto-imports (#app)');
  }
  if (hasAutoImports) {
    notes.push('Component uses Nuxt 3 composables (auto-imported)');
  }
  if (!hasNuxtImports && !hasAutoImports) {
    notes.push('Component appears to be standard Vue 3 (works in Nuxt)');
  }

  return {
    content,
    modified: false,
    notes,
  };
}

function getSrcRoot(filePath: string): string | null {
  const srcSegment = `${sep}src${sep}`;
  const srcIndex = filePath.lastIndexOf(srcSegment);

  if (srcIndex === -1) {
    return null;
  }

  return filePath.slice(0, srcIndex + srcSegment.length - 1);
}

/**
 * Transform Angular relative imports to match the copied component layout.
 *
 * Angular source files live under packages/angular/src/components/* and often
 * import ../../lib/utils. When copied into src/components/ui/*, that same
 * relative path needs to point one directory higher.
 */
function transformAngularComponent(
  content: string,
  filePath: string,
): TransformResult {
  const notes: string[] = [];
  let modified = false;

  const srcRoot = getSrcRoot(filePath);
  if (!srcRoot) {
    return {
      content,
      modified: false,
      notes: [
        'Angular file path does not include src/, skipping relative import rewrite',
      ],
    };
  }

  const currentDir = dirname(filePath);
  const utilsDir = join(srcRoot, 'lib');
  const utilsImportPrefix = relative(currentDir, utilsDir).split(sep).join('/');

  const transformedContent = content.replace(
    /from\s+['"]\.\.\/\.\.\/lib\/([^'"]+)['"]/g,
    (_match, importPath) => {
      modified = true;
      return `from '${utilsImportPrefix}/${importPath}'`;
    },
  );

  if (modified) {
    notes.push(
      `Rewrote Angular relative lib imports to ${utilsImportPrefix}/... for copied component layout`,
    );
  } else {
    notes.push('No Angular relative lib imports needed rewriting');
  }

  return {
    content: transformedContent,
    modified,
    notes,
  };
}

/**
 * Transform import paths to match user's project structure
 *
 * Transforms @/components/xxx to @/components/ui/xxx
 */
function transformImportPaths(content: string): TransformResult {
  const notes: string[] = [];
  let modified = false;
  let transformedContent = content;

  // Transform @/components/ imports to @/components/ui/
  // Match patterns like: from '@/components/calendar'
  const importPattern = /from\s+['"]@\/components\/([^'"]+)['"]/g;

  transformedContent = content.replace(
    importPattern,
    (match, componentPath) => {
      // Skip if already has /ui/ in path
      if (componentPath.includes('ui/')) {
        return match;
      }
      modified = true;
      notes.push(
        `Transformed import path: @/components/${componentPath} -> @/components/ui/${componentPath}`,
      );
      return `from '@/components/ui/${componentPath}'`;
    },
  );

  return {
    content: transformedContent,
    modified,
    notes,
  };
}

/**
 * Transform component file based on platform
 *
 * @param content - File content
 * @param options - Transform options
 * @returns Transform result
 */
export function transformComponent(
  content: string,
  options: TransformOptions,
): TransformResult {
  const { platform, componentName, filePath } = options;

  // First, apply import path transformations for all platforms
  const importTransform = transformImportPaths(content);
  let transformedContent = importTransform.content;
  let notes = [...importTransform.notes];
  let modified = importTransform.modified;

  // Then apply platform-specific transformations
  let platformResult: TransformResult;
  switch (platform) {
    case 'nextjs':
      platformResult = transformNextjsComponent(
        transformedContent,
        componentName,
      );
      break;

    case 'nuxtjs':
      platformResult = transformNuxtjsComponent(
        transformedContent,
        componentName,
      );
      break;

    case 'angular':
      platformResult = transformAngularComponent(transformedContent, filePath);
      break;

    // Other platforms don't need additional transformation
    case 'react':
    case 'vue':
    case 'react-native':
    case 'flutter':
    default:
      platformResult = {
        content: transformedContent,
        modified: false,
        notes: modified ? [] : ['No transformation needed for this platform'],
      };
  }

  return {
    content: platformResult.content,
    modified: modified || platformResult.modified,
    notes: [...notes, ...platformResult.notes],
  };
}

/**
 * Transform component file from file path
 *
 * @param filePath - Path to component file
 * @param options - Transform options
 * @returns Transform result
 */
export function transformComponentFile(
  filePath: string,
  options: Omit<TransformOptions, 'filePath'>,
): TransformResult {
  const content = readFileSync(filePath, 'utf-8');
  return transformComponent(content, { ...options, filePath });
}

/**
 * Batch transform multiple files
 *
 * @param files - Array of file paths
 * @param options - Transform options (without filePath)
 * @returns Array of transform results
 */
export function transformComponentFiles(
  files: string[],
  options: Omit<TransformOptions, 'filePath' | 'componentName'>,
): Map<string, TransformResult> {
  const results = new Map<string, TransformResult>();

  for (const filePath of files) {
    const componentName =
      options.componentName || extractComponentName(filePath);
    const result = transformComponentFile(filePath, {
      ...options,
      componentName,
    });
    results.set(filePath, result);
  }

  return results;
}

/**
 * Extract component name from file path
 */
function extractComponentName(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';
  return fileName.replace(/\.(tsx?|vue|js|jsx)$/, '');
}
