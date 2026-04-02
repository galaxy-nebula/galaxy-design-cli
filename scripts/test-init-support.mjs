import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { withTempProject } from './test-helpers.mjs';

async function testInitDependencyPlans() {
  const { getInitDependencyPlan } = await import('../dist/commands/init.js');

  const reactNativePlan = getInitDependencyPlan({
    framework: 'react-native',
    iconLibrary: 'lucide',
    typescript: true,
    tailwindMode: 'v3',
  });

  assert.equal(reactNativePlan.dependencies.includes('nativewind'), true);
  assert.equal(
    reactNativePlan.dependencies.includes('class-variance-authority'),
    true,
  );
  assert.equal(reactNativePlan.dependencies.includes('clsx'), true);
  assert.equal(reactNativePlan.dependencies.includes('tailwindcss'), false);
  assert.equal(
    reactNativePlan.devDependencies.includes('tailwindcss@^3.4.0'),
    true,
  );
  assert.equal(
    reactNativePlan.devDependencies.includes('babel-plugin-module-resolver'),
    true,
  );
  assert.equal(reactNativePlan.dependencies.includes('tailwind-merge'), false);

  const flutterPlan = getInitDependencyPlan({
    framework: 'flutter',
    iconLibrary: 'lucide',
    typescript: false,
    tailwindMode: null,
  });

  assert.deepEqual(flutterPlan, {
    dependencies: [],
    devDependencies: [],
  });

  console.log('PASS init dependency plans');
}

async function testUtilsTemplates() {
  const { getUtilsTemplate } = await import('../dist/commands/init.js');

  const reactNativeTemplate = getUtilsTemplate('react-native', true);
  assert.equal(reactNativeTemplate?.fileExtension, '.ts');
  assert.match(reactNativeTemplate.content, /clsx/);
  assert.doesNotMatch(reactNativeTemplate.content, /tailwind-merge/);

  const reactJsTemplate = getUtilsTemplate('react', false);
  assert.equal(reactJsTemplate?.fileExtension, '.js');
  assert.doesNotMatch(reactJsTemplate.content, /type ClassValue/);
  assert.match(reactJsTemplate.content, /twMerge/);

  const flutterTemplate = getUtilsTemplate('flutter', false);
  assert.equal(flutterTemplate, null);

  console.log('PASS utils templates');
}

async function testReactNativeRuntimeScaffold() {
  const { configureReactNativeRuntime, detectExpoProject } =
    await import('../dist/commands/init.js');

  await withTempProject('react-native-runtime', async (targetDir) => {
    await writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify(
        {
          dependencies: {
            expo: '^51.0.0',
            'react-native': '^0.74.0',
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(targetDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: {} }, null, 2),
    );
    await writeFile(
      path.join(targetDir, 'App.tsx'),
      'export default function App() { return null; }\n',
    );

    assert.equal(detectExpoProject(targetDir), true);

    const result = configureReactNativeRuntime({
      cwd: targetDir,
      cssPath: 'global.css',
      tailwindConfigPath: 'tailwind.config.js',
      baseColor: 'slate',
      usesSrcDir: true,
      isExpo: true,
    });

    assert.equal(result.written.includes('global.css'), true);
    assert.equal(result.written.includes('tailwind.config.js'), true);
    assert.equal(result.written.includes('metro.config.js'), true);
    assert.equal(result.written.includes('babel.config.js'), true);
    assert.equal(result.written.includes('App.tsx'), true);

    assert.equal(existsSync(path.join(targetDir, 'babel.config.js')), true);
    assert.equal(existsSync(path.join(targetDir, 'metro.config.js')), true);
    assert.match(
      readFileSync(path.join(targetDir, 'babel.config.js'), 'utf-8'),
      /nativewind\/babel/,
    );
    assert.match(
      readFileSync(path.join(targetDir, 'babel.config.js'), 'utf-8'),
      /module-resolver/,
    );
    assert.match(
      readFileSync(path.join(targetDir, 'metro.config.js'), 'utf-8'),
      /withNativeWind/,
    );
    assert.match(
      readFileSync(path.join(targetDir, 'tailwind.config.js'), 'utf-8'),
      /nativewind\/preset/,
    );
    assert.match(
      readFileSync(path.join(targetDir, 'global.css'), 'utf-8'),
      /@tailwind base;/,
    );
    assert.match(
      readFileSync(path.join(targetDir, 'App.tsx'), 'utf-8'),
      /import '\.\/global\.css';/,
    );
  });

  console.log('PASS react-native runtime scaffold');
}

async function testPubPackageManagerSupport() {
  const packageManager = await import('../dist/utils/package-manager.js');

  await withTempProject('pub-package-manager', async (targetDir) => {
    await mkdir(targetDir, { recursive: true });
    await writeFile(
      path.join(targetDir, 'pubspec.yaml'),
      'name: sample_app\ndescription: sample\n',
    );

    assert.equal(packageManager.detectPackageManager(targetDir), 'pub');
    assert.equal(
      packageManager.formatInstallCommand('pub', ['intl']),
      'flutter pub add intl',
    );
  });

  console.log('PASS pub package manager support');
}

async function testInitWorkflowContext() {
  const initWorkflow = await import('../dist/utils/init-workflow.js');

  await withTempProject('init-workflow-next', async (targetDir) => {
    await writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify(
        {
          dependencies: {
            next: '^16.2.1',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
          devDependencies: {
            tailwindcss: '^3.4.17',
            autoprefixer: '^10.4.20',
            postcss: '^8.4.49',
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(targetDir, 'src', 'index.css'),
      '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
    );

    const context = initWorkflow.resolveInitProjectContext(targetDir);
    assert.equal(context.framework, 'nextjs');
    assert.equal(context.packageManager, 'npm');
    assert.equal(context.usesSrcDir, true);
    assert.equal(context.tailwindMode, 'v3');
    assert.equal(context.config.tailwind.css, 'app/globals.css');

    const answersConfig = initWorkflow.applyInitPromptAnswers(context.config, {
      cssFile: 'src/custom.css',
      baseColor: 'zinc',
    });
    assert.equal(answersConfig.tailwind.css, 'src/custom.css');
    assert.equal(answersConfig.tailwind.baseColor, 'zinc');

    initWorkflow.ensureInitDirectories(targetDir, answersConfig, true);
    assert.equal(existsSync(path.join(targetDir, 'src', 'components')), true);
    assert.equal(
      existsSync(path.join(targetDir, 'src', 'components', 'ui')),
      true,
    );
    assert.equal(existsSync(path.join(targetDir, 'src', 'lib')), true);
  });

  console.log('PASS init workflow context');
}

async function testInitRuntimeScaffold() {
  const initRuntime = await import('../dist/utils/init-runtime.js');

  await withTempProject('init-runtime-web', async (targetDir) => {
    const result = initRuntime.scaffoldInitFrameworkRuntime({
      cwd: targetDir,
      framework: 'react',
      tailwindMode: 'v4',
      cssPath: 'src/index.css',
      tailwindConfigPath: '',
      baseColor: 'slate',
      usesSrcDir: true,
      isExpoProject: false,
    });

    assert.equal(result?.written.includes('postcss.config.mjs'), true);
    assert.equal(result?.written.includes('src/index.css'), true);
    assert.match(
      readFileSync(path.join(targetDir, 'src', 'index.css'), 'utf-8'),
      /@import "tailwindcss"/,
    );
  });

  console.log('PASS init runtime scaffold');
}

await testInitDependencyPlans();
await testUtilsTemplates();
await testReactNativeRuntimeScaffold();
await testPubPackageManagerSupport();
await testInitWorkflowContext();
await testInitRuntimeScaffold();

console.log('init support checks passed');
