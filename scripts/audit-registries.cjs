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

function auditFiles(framework, components, issues) {
  const root = COMPONENT_ROOTS[framework];

  for (const [componentName, component] of Object.entries(components)) {
    for (const file of component.files || []) {
      const fullPath = path.join(root, componentName, file);
      if (!fs.existsSync(fullPath)) {
        issues.push(`[${framework}] missing file: ${componentName}/${file}`);
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
    registries[framework] = readJson(file).components;
    auditFiles(framework, registries[framework], issues);
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
