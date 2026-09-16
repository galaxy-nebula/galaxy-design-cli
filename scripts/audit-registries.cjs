#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKSPACE_ROOT = path.join(ROOT, '..');
const DESIGN_ROOT = path.join(WORKSPACE_ROOT, 'galaxy-design');
const CLI_SRC = path.join(ROOT, 'src');

const REGISTRY_FILES = {
  react: path.join(CLI_SRC, 'registries', 'registry-react.json'),
  vue: path.join(CLI_SRC, 'registries', 'registry-vue.json'),
  angular: path.join(CLI_SRC, 'registries', 'registry-angular.json'),
  'react-native': path.join(
    CLI_SRC,
    'registries',
    'registry-react-native.json',
  ),
  flutter: path.join(CLI_SRC, 'registries', 'registry-flutter.json'),
};

const BLOCK_REGISTRY_FILES = Object.fromEntries(
  Object.keys(REGISTRY_FILES).map((framework) => [
    framework,
    path.join(CLI_SRC, 'registries', `blocks-${framework}.json`),
  ]),
);

const COMPONENT_ROOTS = {
  react: path.join(DESIGN_ROOT, 'packages', 'react', 'src', 'components'),
  vue: path.join(DESIGN_ROOT, 'packages', 'vue', 'src', 'components'),
  angular: path.join(DESIGN_ROOT, 'packages', 'angular', 'src', 'components'),
  'react-native': path.join(
    DESIGN_ROOT,
    'packages',
    'react-native',
    'src',
    'components',
  ),
  flutter: path.join(DESIGN_ROOT, 'packages', 'flutter', 'lib', 'components'),
};

const BLOCK_ROOTS = {
  react: path.join(DESIGN_ROOT, 'packages', 'react', 'src', 'blocks'),
  vue: path.join(DESIGN_ROOT, 'packages', 'vue', 'src', 'blocks'),
  angular: path.join(DESIGN_ROOT, 'packages', 'angular', 'src', 'blocks'),
  'react-native': path.join(
    DESIGN_ROOT,
    'packages',
    'react-native',
    'src',
    'blocks',
  ),
  flutter: path.join(DESIGN_ROOT, 'packages', 'flutter', 'lib', 'blocks'),
};

const FRAMEWORK_RUNTIME_PACKAGES = new Set([
  '@angular/common',
  '@angular/core',
  '@angular/forms',
  'react',
  'react-dom',
  'react-native',
  'rxjs',
  'vue',
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseAngularSelectors(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  return [...text.matchAll(/selector:\s*'([^']+)'/g)].map((match) => match[1]);
}

function parseNamedExports(indexPath, language) {
  if (!fs.existsSync(indexPath)) return { explicit: false, names: [] };
  const text = fs.readFileSync(indexPath, 'utf8');
  if (/export\s+\*\s+from/.test(text)) {
    return { explicit: false, names: [] };
  }

  const names = [];
  const regex = /export\s*\{([^}]*)\}/gms;
  for (const match of text.matchAll(regex)) {
    const parts = match[1].split(',');
    for (const raw of parts) {
      const part = raw.trim();
      if (!part || part.startsWith('type ')) continue;

      const alias = part.match(/^(.+?)\s+as\s+(.+)$/);
      const publicName = alias ? alias[2].trim() : part;
      if (/^[A-Z]/.test(publicName)) {
        names.push(publicName);
      }
    }
  }

  return { explicit: true, names: [...new Set(names)] };
}

function normalizeBlockSourceName(framework, componentName) {
  if (framework === 'react-native' && componentName === 'sidebar') {
    return 'drawer';
  }
  if (framework === 'flutter' && componentName === 'chat-ui') {
    return 'chat_ui';
  }
  if (framework === 'flutter' && componentName === 'sidebar') {
    return 'drawer';
  }
  return componentName;
}

function getPackageName(specifier) {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('@/') ||
    specifier.startsWith('~/') ||
    specifier.startsWith('package:') ||
    specifier.startsWith('node:')
  ) {
    return null;
  }
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
}

function auditFiles(framework, components, issues, options = {}) {
  const root = options.blocks
    ? BLOCK_ROOTS[framework]
    : COMPONENT_ROOTS[framework];

  for (const [componentName, component] of Object.entries(components)) {
    const sourceName = options.blocks
      ? normalizeBlockSourceName(framework, componentName)
      : componentName;
    const declaredPackages = new Set(
      [
        ...(component.dependencies || []),
        ...(component.devDependencies || []),
        ...(component.peerDependencies || []),
      ]
        .map(getPackageName)
        .filter(Boolean),
    );

    for (const file of component.files || []) {
      const fullPath = path.join(root, sourceName, file);
      if (!fs.existsSync(fullPath)) {
        issues.push(
          `[${framework}${options.blocks ? '/blocks' : ''}] missing file: ${sourceName}/${file}`,
        );
        continue;
      }

      const source = fs.readFileSync(fullPath, 'utf8');
      const importPattern = /(?:from\s+|import\s*\()['"]([^'"]+)['"]/g;
      for (const match of source.matchAll(importPattern)) {
        const packageName = getPackageName(match[1]);
        if (
          packageName &&
          !FRAMEWORK_RUNTIME_PACKAGES.has(packageName) &&
          !declaredPackages.has(packageName)
        ) {
          issues.push(
            `[${framework}${options.blocks ? '/blocks' : ''}] undeclared package for ${componentName}: ${packageName}`,
          );
        }
      }
    }
  }
}

function auditRegistryDocument(file, registry, issues) {
  if (!registry.$schema) {
    issues.push(`[schema] missing $schema in ${path.basename(file)}`);
  } else {
    const schemaPath = path.resolve(path.dirname(file), registry.$schema);
    if (!fs.existsSync(schemaPath)) {
      issues.push(
        `[schema] unresolved $schema in ${path.basename(file)}: ${registry.$schema}`,
      );
    }
  }

  for (const [groupName, group] of Object.entries(registry.groups || {})) {
    for (const componentName of group.components || []) {
      if (!registry.components?.[componentName]) {
        issues.push(
          `[${registry.name || path.basename(file)}] group ${groupName} references missing component: ${componentName}`,
        );
      }
    }
  }
}

function auditRegistryDependencies(framework, registry, baseRegistry, issues) {
  for (const [componentName, component] of Object.entries(
    registry.components || {},
  )) {
    for (const dependency of component.registryDependencies || []) {
      if (!baseRegistry.components?.[dependency]) {
        issues.push(
          `[${framework}] ${componentName} references missing registry dependency: ${dependency}`,
        );
      }
    }
  }
}

function auditAngular(components, issues) {
  const root = COMPONENT_ROOTS.angular;

  for (const [componentName, component] of Object.entries(components)) {
    const componentFile = (component.files || []).find((file) =>
      file.endsWith('.component.ts'),
    );
    if (componentFile) {
      const selectors = parseAngularSelectors(
        path.join(root, componentName, componentFile),
      );
      if (selectors.length > 0 && !selectors.includes(component.selector)) {
        issues.push(
          `[angular] selector mismatch for ${componentName}: registry="${component.selector || ''}" source="${selectors.join(', ')}"`,
        );
      }
    }

    const indexPath = path.join(root, componentName, 'index.ts');
    const parsed = parseNamedExports(indexPath, 'ts');
    if (!parsed.explicit || !component.exports) continue;

    const registryNames = component.exports.filter((name) =>
      /^[A-Z]/.test(name),
    );
    const missing = parsed.names.filter(
      (name) => !registryNames.includes(name),
    );
    const extra = registryNames.filter((name) => !parsed.names.includes(name));

    if (missing.length) {
      issues.push(
        `[angular] missing exports for ${componentName}: ${missing.join(', ')}`,
      );
    }
    if (extra.length) {
      issues.push(
        `[angular] extra exports for ${componentName}: ${extra.join(', ')}`,
      );
    }

    if (component.providers) {
      if (
        typeof component.providers.import !== 'string' ||
        component.providers.import.trim() === ''
      ) {
        issues.push(`[angular] invalid providers.import for ${componentName}`);
      }

      if (
        typeof component.providers.function !== 'string' ||
        component.providers.function.trim() === ''
      ) {
        issues.push(
          `[angular] invalid providers.function for ${componentName}`,
        );
      }
    }
  }
}

function auditReactNative(components, issues) {
  const root = COMPONENT_ROOTS['react-native'];

  for (const [componentName, component] of Object.entries(components)) {
    const indexPath = path.join(root, componentName, 'index.ts');
    const parsed = parseNamedExports(indexPath, 'ts');
    if (!parsed.explicit || !component.exports) continue;

    const registryNames = component.exports.filter((name) =>
      /^[A-Z]/.test(name),
    );
    const missing = parsed.names.filter(
      (name) => !registryNames.includes(name),
    );
    const extra = registryNames.filter((name) => !parsed.names.includes(name));

    if (missing.length) {
      issues.push(
        `[react-native] missing exports for ${componentName}: ${missing.join(', ')}`,
      );
    }
    if (extra.length) {
      issues.push(
        `[react-native] extra exports for ${componentName}: ${extra.join(', ')}`,
      );
    }
  }
}

function auditSummary(summary, registries, issues) {
  const summaryComponents = summary.components;
  const frameworkMap = {
    react: 'react',
    vue: 'vue',
    angular: 'angular',
    'react-native': 'react-native',
    flutter: 'flutter',
  };

  for (const [componentName, component] of Object.entries(summaryComponents)) {
    for (const [registryKey, summaryFramework] of Object.entries(
      frameworkMap,
    )) {
      const inRegistry = Boolean(registries[registryKey][componentName]);
      const inSummary = (component.frameworks || []).includes(summaryFramework);
      if (inRegistry !== inSummary) {
        issues.push(
          `[summary] framework mismatch for ${componentName}/${summaryFramework}: summary=${inSummary} registry=${inRegistry}`,
        );
      }
    }
  }
}

function main() {
  const issues = [];
  const registries = {};

  for (const [framework, file] of Object.entries(REGISTRY_FILES)) {
    const registry = readJson(file);
    registries[framework] = registry.components;
    auditRegistryDocument(file, registry, issues);
    auditFiles(framework, registry.components, issues);

    const blockFile = BLOCK_REGISTRY_FILES[framework];
    const blockRegistry = readJson(blockFile);
    auditRegistryDocument(blockFile, blockRegistry, issues);
    auditRegistryDependencies(framework, blockRegistry, registry, issues);
    auditFiles(framework, blockRegistry.components, issues, { blocks: true });
  }

  auditAngular(registries.angular, issues);
  auditReactNative(registries['react-native'], issues);
  auditSummary(
    readJson(path.join(CLI_SRC, 'registry.json')),
    registries,
    issues,
  );

  if (issues.length) {
    console.error('Registry audit failed:\n');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log('Registry audit passed.');
}

main();
