import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import type { BaseColor, Framework } from './config-schema.js';

export type TailwindMode = 'v3' | 'v4';

export interface TailwindScaffoldOptions {
  cwd: string;
  framework: Framework;
  mode: TailwindMode;
  configPath?: string;
  cssPath: string;
  baseColor: BaseColor;
  overwriteExisting?: boolean;
}

export interface TailwindScaffoldResult {
  written: string[];
  skipped: string[];
}

const POSTCSS_CONFIG_FILES = [
  'postcss.config.mjs',
  'postcss.config.js',
  'postcss.config.cjs',
];

function ensureParentDirectory(filePath: string): void {
  const parentDir = dirname(filePath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
}

function findExistingPostcssConfig(cwd: string): string | undefined {
  return POSTCSS_CONFIG_FILES.find((candidate) =>
    existsSync(resolve(cwd, candidate)),
  );
}

function writeIfNeeded(
  cwd: string,
  relativePath: string,
  content: string,
  overwriteExisting: boolean,
  result: TailwindScaffoldResult,
): void {
  const fullPath = resolve(cwd, relativePath);

  if (existsSync(fullPath) && !overwriteExisting) {
    result.skipped.push(relativePath);
    return;
  }

  ensureParentDirectory(fullPath);
  writeFileSync(fullPath, content, 'utf-8');
  result.written.push(relativePath);
}

function ensureTailwindCss(
  cwd: string,
  cssPath: string,
  content: string,
  result: TailwindScaffoldResult,
): void {
  const fullPath = resolve(cwd, cssPath);

  if (!existsSync(fullPath)) {
    ensureParentDirectory(fullPath);
    writeFileSync(fullPath, content, 'utf-8');
    result.written.push(cssPath);
    return;
  }

  const existingContent = readFileSync(fullPath, 'utf-8');
  if (
    existingContent.includes('@import "tailwindcss"') ||
    existingContent.includes("@import 'tailwindcss'") ||
    /@tailwind\s+(base|components|utilities)/.test(existingContent)
  ) {
    result.skipped.push(cssPath);
    return;
  }

  writeFileSync(
    fullPath,
    `${content}\n${existingContent}`.trimEnd() + '\n',
    'utf-8',
  );
  result.written.push(cssPath);
}

export function getTailwindDevDependencies(mode: TailwindMode): string[] {
  if (mode === 'v4') {
    return ['tailwindcss', '@tailwindcss/postcss'];
  }

  return ['tailwindcss@^3.4.0', 'autoprefixer', 'postcss'];
}

export function scaffoldTailwindFiles(
  options: TailwindScaffoldOptions,
): TailwindScaffoldResult {
  const result: TailwindScaffoldResult = {
    written: [],
    skipped: [],
  };

  const overwriteExisting = options.overwriteExisting ?? false;
  const postcssConfigPath =
    findExistingPostcssConfig(options.cwd) ||
    (options.mode === 'v4' ? 'postcss.config.mjs' : 'postcss.config.js');

  writeIfNeeded(
    options.cwd,
    postcssConfigPath,
    getPostCSSConfigContent(options.mode, options.framework),
    overwriteExisting,
    result,
  );

  if (options.mode === 'v3' && options.configPath) {
    writeIfNeeded(
      options.cwd,
      options.configPath,
      getTailwindConfigContent(options.framework),
      overwriteExisting,
      result,
    );
  }

  ensureTailwindCss(
    options.cwd,
    options.cssPath,
    getCSSContent(options.baseColor, options.mode),
    result,
  );

  return result;
}

function getTailwindConfigContent(framework: Framework): string {
  const contentPaths =
    framework === 'react' || framework === 'nextjs'
      ? `[
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ]`
      : framework === 'vue' || framework === 'nuxtjs'
        ? `[
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ]`
        : framework === 'angular'
          ? `[
    "./src/**/*.{html,ts}",
    "./src/components/**/*.{html,ts}",
  ]`
          : `[
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ]`;

  const exportStatement =
    framework === 'angular' ? 'module.exports = ' : 'export default ';

  return `/** @type {import('tailwindcss').Config} */
${exportStatement}{
  darkMode: ["class"],
  content: ${contentPaths},
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
`;
}

function getPostCSSConfigContent(
  mode: TailwindMode,
  framework: Framework,
): string {
  if (mode === 'v4') {
    return `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
`;
  }

  if (framework === 'angular') {
    return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
  }

  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
}

function getCSSContent(baseColor: BaseColor, mode: TailwindMode): string {
  const colorVariables: Record<BaseColor, { light: string; dark: string }> = {
    slate: {
      light: `--background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;`,
      dark: `--background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;`,
    },
    gray: {
      light: `--background: 0 0% 100%;
    --foreground: 224 71.4% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 224 71.4% 4.1%;
    --popover: 0 0% 100%;
    --popover-foreground: 224 71.4% 4.1%;
    --primary: 220.9 39.3% 11%;
    --primary-foreground: 210 20% 98%;
    --secondary: 220 14.3% 95.9%;
    --secondary-foreground: 220.9 39.3% 11%;
    --muted: 220 14.3% 95.9%;
    --muted-foreground: 220 8.9% 46.1%;
    --accent: 220 14.3% 95.9%;
    --accent-foreground: 220.9 39.3% 11%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 20% 98%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 224 71.4% 4.1%;
    --radius: 0.5rem;`,
      dark: `--background: 224 71.4% 4.1%;
    --foreground: 210 20% 98%;
    --card: 224 71.4% 4.1%;
    --card-foreground: 210 20% 98%;
    --popover: 224 71.4% 4.1%;
    --popover-foreground: 210 20% 98%;
    --primary: 210 20% 98%;
    --primary-foreground: 220.9 39.3% 11%;
    --secondary: 215 27.9% 16.9%;
    --secondary-foreground: 210 20% 98%;
    --muted: 215 27.9% 16.9%;
    --muted-foreground: 217.9 10.6% 64.9%;
    --accent: 215 27.9% 16.9%;
    --accent-foreground: 210 20% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 20% 98%;
    --border: 215 27.9% 16.9%;
    --input: 215 27.9% 16.9%;
    --ring: 216 12.2% 83.9%;`,
    },
    zinc: {
      light: `--background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 10% 3.9%;
    --radius: 0.5rem;`,
      dark: `--background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;`,
    },
    neutral: {
      light: `--background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --radius: 0.5rem;`,
      dark: `--background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;`,
    },
    stone: {
      light: `--background: 0 0% 100%;
    --foreground: 20 14.3% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 20 14.3% 4.1%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 14.3% 4.1%;
    --primary: 24 9.8% 10%;
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 60 4.8% 95.9%;
    --secondary-foreground: 24 9.8% 10%;
    --muted: 60 4.8% 95.9%;
    --muted-foreground: 25 5.3% 44.7%;
    --accent: 60 4.8% 95.9%;
    --accent-foreground: 24 9.8% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 20 5.9% 90%;
    --input: 20 5.9% 90%;
    --ring: 20 14.3% 4.1%;
    --radius: 0.5rem;`,
      dark: `--background: 20 14.3% 4.1%;
    --foreground: 60 9.1% 97.8%;
    --card: 20 14.3% 4.1%;
    --card-foreground: 60 9.1% 97.8%;
    --popover: 20 14.3% 4.1%;
    --popover-foreground: 60 9.1% 97.8%;
    --primary: 60 9.1% 97.8%;
    --primary-foreground: 24 9.8% 10%;
    --secondary: 12 6.5% 15.1%;
    --secondary-foreground: 60 9.1% 97.8%;
    --muted: 12 6.5% 15.1%;
    --muted-foreground: 24 5.4% 63.9%;
    --accent: 12 6.5% 15.1%;
    --accent-foreground: 60 9.1% 97.8%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 12 6.5% 15.1%;
    --input: 12 6.5% 15.1%;
    --ring: 24 5.7% 82.9%;`,
    },
  };

  const colors = colorVariables[baseColor];
  const tailwindEntry =
    mode === 'v4'
      ? '@import "tailwindcss";'
      : `@tailwind base;\n@tailwind components;\n@tailwind utilities;`;

  return `${tailwindEntry}

@layer base {
  :root {
    ${colors.light}
  }

  .dark {
    ${colors.dark}
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;
}
