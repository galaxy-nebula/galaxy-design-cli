#!/usr/bin/env node
/**
 * Sync Vue registry with actual base components
 * This ensures registry always matches the actual files in packages/vue
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '../../galaxy-design/packages');
const VUE_COMPONENTS_DIR = path.join(PACKAGES_DIR, 'vue/src/components');
const REGISTRY_FILE = path.join(__dirname, '../src/registries/registry-vue.json');

console.log('🔍 Scanning Vue components...');
console.log(`Vue components dir: ${VUE_COMPONENTS_DIR}`);

// Read current registry
const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));

// Get all component directories
const componentDirs = fs.readdirSync(VUE_COMPONENTS_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

let fixed = 0;
let skipped = 0;

console.log(`\n📦 Found ${componentDirs.length} components\n`);

for (const componentName of componentDirs) {
  const componentDir = path.join(VUE_COMPONENTS_DIR, componentName);

  // Get all .vue, .ts, and .tsx files (excluding .test.ts and test directories)
  const files = fs.readdirSync(componentDir)
    .filter(file => {
      return (file.endsWith('.vue') || file.endsWith('.ts') || file.endsWith('.tsx'))
        && !file.includes('.test.')
        && !file.includes('__tests__');
    })
    .sort((a, b) => {
      // Sort: index.ts last, .vue files first
      if (a === 'index.ts') return 1;
      if (b === 'index.ts') return -1;
      return a.localeCompare(b);
    });

  if (files.length === 0) {
    console.log(`⚠️  ${componentName}: No files found, skipping`);
    skipped++;
    continue;
  }

  // Check if component exists in registry
  if (!registry.components[componentName]) {
    console.log(`⚠️  ${componentName}: Not in registry, skipping`);
    skipped++;
    continue;
  }

  const registryFiles = registry.components[componentName].files || [];
  const filesMatch = JSON.stringify(registryFiles.sort()) === JSON.stringify(files.sort());

  if (filesMatch) {
    console.log(`✅ ${componentName}: ${files.length} files (already correct)`);
    skipped++;
  } else {
    console.log(`🔧 ${componentName}: Updating files`);
    console.log(`   Old: [${registryFiles.join(', ')}]`);
    console.log(`   New: [${files.join(', ')}]`);

    // Update registry
    registry.components[componentName].files = files;
    fixed++;
  }
}

// Write updated registry
fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');

console.log(`\n✨ Sync complete!`);
console.log(`   Fixed: ${fixed} components`);
console.log(`   Skipped: ${skipped} components`);
console.log(`   Total: ${componentDirs.length} components`);
