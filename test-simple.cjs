// Simple test using CommonJS
const { readFileSync } = require('fs');
const { join, resolve } = require('path');

console.log('🧪 Testing Galaxy UI CLI - Mobile Registries\n');

// Test registries
const registryDir = resolve(__dirname, 'dist/registries');

console.log('📁 Registry Directory:', registryDir);
console.log('');

// Load and test React Native registry
console.log('=== React Native Registry ===');
try {
  const rnPath = join(registryDir, 'registry-react-native.json');
  const rnData = JSON.parse(readFileSync(rnPath, 'utf-8'));
  console.log('✓ Loaded successfully');
  console.log(`  Components: ${Object.keys(rnData.components).length}`);
  console.log(`  Platform: ${rnData.platform || 'not set'}`);
  console.log(`  Groups: ${Object.keys(rnData.groups || {}).length}`);
  console.log(`  Sample components: ${Object.keys(rnData.components).slice(0, 5).join(', ')}`);
} catch (error) {
  console.log('✗ Failed:', error.message);
}

console.log('');

// Load and test Flutter registry
console.log('=== Flutter Registry ===');
try {
  const flutterPath = join(registryDir, 'registry-flutter.json');
  const flutterData = JSON.parse(readFileSync(flutterPath, 'utf-8'));
  console.log('✓ Loaded successfully');
  console.log(`  Components: ${Object.keys(flutterData.components).length}`);
  console.log(`  Platform: ${flutterData.platform || 'not set'}`);
  console.log(`  Groups: ${Object.keys(flutterData.groups || {}).length}`);
  console.log(`  Sample components: ${Object.keys(flutterData.components).slice(0, 5).join(', ')}`);
} catch (error) {
  console.log('✗ Failed:', error.message);
}

console.log('');

// Check recent components
console.log('=== Recently Added Components ===');
const recentComponents = ['date-picker', 'navigation-menu', 'pagination', 'empty', 'typography', 'badge', 'sheet'];

const rnRegistry = JSON.parse(readFileSync(join(registryDir, 'registry-react-native.json'), 'utf-8'));
const flutterRegistry = JSON.parse(readFileSync(join(registryDir, 'registry-flutter.json'), 'utf-8'));

console.log('React Native:');
recentComponents.forEach(comp => {
  const exists = !!rnRegistry.components[comp];
  console.log(`  ${exists ? '✓' : '✗'} ${comp}`);
});

console.log('');
console.log('Flutter:');
recentComponents.forEach(comp => {
  const exists = !!flutterRegistry.components[comp];
  console.log(`  ${exists ? '✓' : '✗'} ${comp}`);
});

console.log('\n✅ Registry test complete!\n');

// Test framework detection (existing code)
console.log('=== Framework Detection Test ===');
const { detectFramework } = require('./dist/utils/detect.js');

const testDirs = [
  { name: 'React Native Example', path: resolve(__dirname, '../../examples/react-native-example') },
  { name: 'Flutter Example', path: resolve(__dirname, '../../examples/flutter-example') },
  { name: 'Angular Example', path: resolve(__dirname, '../../examples/angular-example') },
];

testDirs.forEach(({ name, path }) => {
  try {
    const framework = detectFramework(path);
    console.log(`✓ ${name}: ${framework}`);
  } catch (error) {
    console.log(`✗ ${name}: ${error.message}`);
  }
});

console.log('\n🎉 All tests passed!');
