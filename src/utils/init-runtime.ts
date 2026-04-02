import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { writeFile } from './files.js';
import {
  scaffoldTailwindFiles,
  type TailwindMode,
  type TailwindScaffoldResult,
} from './tailwind-scaffold.js';
import type { BaseColor, Framework } from './config-schema.js';

export interface ReactNativeRuntimeOptions {
  cwd: string;
  cssPath: string;
  tailwindConfigPath: string;
  baseColor: BaseColor;
  usesSrcDir: boolean;
  isExpo: boolean;
}

export interface RuntimeScaffoldResult {
  written: string[];
  skipped: string[];
}

export function scaffoldInitFrameworkRuntime(options: {
  cwd: string;
  framework: Framework;
  tailwindMode: TailwindMode | null;
  cssPath: string;
  tailwindConfigPath: string;
  baseColor: BaseColor;
  usesSrcDir: boolean;
  isExpoProject: boolean;
}): RuntimeScaffoldResult | TailwindScaffoldResult | null {
  if (options.framework === 'flutter') {
    return null;
  }

  if (options.framework === 'react-native') {
    return configureReactNativeRuntime({
      cwd: options.cwd,
      cssPath: options.cssPath,
      tailwindConfigPath: options.tailwindConfigPath || 'tailwind.config.js',
      baseColor: options.baseColor,
      usesSrcDir: options.usesSrcDir,
      isExpo: options.isExpoProject,
    });
  }

  return scaffoldTailwindFiles({
    cwd: options.cwd,
    framework: options.framework,
    mode: options.tailwindMode || 'v4',
    configPath: options.tailwindConfigPath,
    cssPath: options.cssPath,
    baseColor: options.baseColor,
    overwriteExisting: false,
  });
}

export function configureReactNativeRuntime(
  options: ReactNativeRuntimeOptions,
): RuntimeScaffoldResult {
  const result: RuntimeScaffoldResult = {
    written: [],
    skipped: [],
  };

  ensureReactNativeStylesheet(
    options.cwd,
    options.cssPath,
    options.baseColor,
    result,
  );
  writeRuntimeFileIfNeeded(
    options.cwd,
    options.tailwindConfigPath,
    getReactNativeTailwindConfigContent(options.usesSrcDir),
    result,
  );
  writeRuntimeFileIfNeeded(
    options.cwd,
    'metro.config.js',
    getReactNativeMetroConfigContent(options.cssPath, options.isExpo),
    result,
  );
  ensureReactNativeBabelConfig(
    options.cwd,
    options.usesSrcDir,
    options.isExpo,
    result,
  );
  ensureEntryImportsStylesheet(options.cwd, options.cssPath, result);

  return result;
}

function writeRuntimeFileIfNeeded(
  cwd: string,
  relativePath: string,
  content: string,
  result: RuntimeScaffoldResult,
): void {
  const filePath = resolve(cwd, relativePath);
  if (existsSync(filePath)) {
    result.skipped.push(relativePath);
    return;
  }

  writeFile(filePath, content);
  result.written.push(relativePath);
}

function ensureReactNativeStylesheet(
  cwd: string,
  cssPath: string,
  baseColor: BaseColor,
  result: RuntimeScaffoldResult,
): void {
  const filePath = resolve(cwd, cssPath);
  const cssContent = getReactNativeCssContent(baseColor);

  if (!existsSync(filePath)) {
    writeFile(filePath, cssContent);
    result.written.push(cssPath);
    return;
  }

  const existingContent = readFileSync(filePath, 'utf-8');
  if (/@tailwind\s+(base|components|utilities)/.test(existingContent)) {
    result.skipped.push(cssPath);
    return;
  }

  writeFileSync(
    filePath,
    `${cssContent}\n${existingContent}`.trimEnd() + '\n',
    'utf-8',
  );
  result.written.push(cssPath);
}

function ensureReactNativeBabelConfig(
  cwd: string,
  usesSrcDir: boolean,
  isExpo: boolean,
  result: RuntimeScaffoldResult,
): void {
  const relativePath = 'babel.config.js';
  const filePath = resolve(cwd, relativePath);
  const aliasTarget = usesSrcDir ? './src' : './';

  if (!existsSync(filePath)) {
    writeFile(filePath, getReactNativeBabelConfigContent(aliasTarget, isExpo));
    result.written.push(relativePath);
    return;
  }

  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  if (
    !content.includes('nativewind/babel') &&
    /plugins\s*:\s*\[/.test(content)
  ) {
    content = content.replace(
      /plugins\s*:\s*\[/,
      `plugins: [\n      ["module-resolver", {\n        alias: {\n          "@": "${aliasTarget}"\n        }\n      }],\n      "nativewind/babel",`,
    );
  } else if (
    !content.includes('module-resolver') &&
    /plugins\s*:\s*\[/.test(content)
  ) {
    content = content.replace(
      /plugins\s*:\s*\[/,
      `plugins: [\n      ["module-resolver", {\n        alias: {\n          "@": "${aliasTarget}"\n        }\n      }],`,
    );
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    result.written.push(relativePath);
  } else {
    result.skipped.push(relativePath);
  }
}

function ensureEntryImportsStylesheet(
  cwd: string,
  cssPath: string,
  result: RuntimeScaffoldResult,
): void {
  const entryCandidates = [
    'app/_layout.tsx',
    'app/_layout.jsx',
    'app/_layout.ts',
    'app/_layout.js',
    'App.tsx',
    'App.jsx',
    'App.ts',
    'App.js',
    'index.ts',
    'index.js',
  ];

  const entryFile = entryCandidates.find((candidate) =>
    existsSync(resolve(cwd, candidate)),
  );

  if (!entryFile) {
    result.skipped.push('entry:global.css import');
    return;
  }

  const entryPath = resolve(cwd, entryFile);
  const importPath = normalizeImportPath(
    relative(dirname(entryPath), resolve(cwd, cssPath)),
  );
  const importStatement = `import '${importPath}';`;
  const content = readFileSync(entryPath, 'utf-8');

  if (content.includes(importStatement)) {
    result.skipped.push(entryFile);
    return;
  }

  writeFileSync(entryPath, `${importStatement}\n${content}`, 'utf-8');
  result.written.push(entryFile);
}

function normalizeImportPath(importPath: string): string {
  const normalized = importPath.replace(/\\/g, '/');
  if (normalized.startsWith('.')) {
    return normalized;
  }

  return `./${normalized}`;
}

function getReactNativeBabelConfigContent(
  aliasTarget: string,
  isExpo: boolean,
): string {
  const preset = isExpo
    ? 'babel-preset-expo'
    : 'module:@react-native/babel-preset';

  return `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["${preset}"],
    plugins: [
      ["module-resolver", {
        alias: {
          "@": "${aliasTarget}"
        }
      }],
      "nativewind/babel"
    ],
  };
};
`;
}

function getReactNativeMetroConfigContent(
  cssPath: string,
  isExpo: boolean,
): string {
  if (isExpo) {
    return `const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./${cssPath}",
});
`;
  }

  return `const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = mergeConfig(getDefaultConfig(__dirname), {});

module.exports = withNativeWind(config, {
  input: "./${cssPath}",
});
`;
}

function getReactNativeTailwindConfigContent(usesSrcDir: boolean): string {
  const contentPath = usesSrcDir
    ? './src/**/*.{js,jsx,ts,tsx}'
    : './**/*.{js,jsx,ts,tsx}';

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "${contentPath}",
  ],
  presets: [require("nativewind/preset")],
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
};
`;
}

function getReactNativeCssContent(baseColor: BaseColor): string {
  return getReactNativeColorVariableBlock(baseColor);
}

function getReactNativeColorVariableBlock(baseColor: BaseColor): string {
  const blocks: Record<BaseColor, string> = {
    slate: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
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
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
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
  --ring: 212.7 26.8% 83.9%;
}
`,
    gray: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
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
  --radius: 0.5rem;
}

.dark {
  --background: 224 71.4% 4.1%;
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
  --ring: 216 12.2% 83.9%;
}
`,
    zinc: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
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
  --radius: 0.5rem;
}

.dark {
  --background: 240 10% 3.9%;
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
  --ring: 240 4.9% 83.9%;
}
`,
    neutral: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
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
  --radius: 0.5rem;
}

.dark {
  --background: 0 0% 3.9%;
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
  --ring: 0 0% 83.1%;
}
`,
    stone: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
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
  --radius: 0.5rem;
}

.dark {
  --background: 20 14.3% 4.1%;
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
  --ring: 24 5.7% 82.9%;
}
`,
  };

  return blocks[baseColor];
}
