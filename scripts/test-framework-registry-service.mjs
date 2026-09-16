import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withTempProject } from './test-helpers.mjs';

async function testFrameworkAliasMapping(service) {
  const registry = service.loadFrameworkRegistry('nextjs');

  assert.equal(registry.framework, 'react');
  assert.equal(typeof registry.components.button, 'object');
  assert.equal(typeof registry.components['chat-ui'], 'object');

  const resolvedName = service.resolveFrameworkComponentName(
    'nextjs',
    'Button',
  );
  assert.equal(resolvedName, 'button');

  console.log('PASS framework alias mapping');
}

async function testDependencyGraphResolution(service) {
  const graph = service.resolveFrameworkComponentGraph('react', ['chat-ui']);

  assert.equal(graph.includes('chat-ui'), true);
  assert.equal(graph.includes('avatar'), true);
  assert.equal(graph.includes('button'), true);
  assert.equal(graph.includes('scroll-area'), true);
  assert.equal(graph.includes('textarea'), true);

  const deps = service.getFrameworkComponentDependencies('react', 'button');
  assert.equal(deps.dependencies.includes('@radix-ui/react-slot'), true);
  assert.equal(deps.dependencies.includes('class-variance-authority'), true);

  console.log('PASS dependency graph resolution');
}

async function testAngularProviderMetadata(service) {
  const tooltip = service.getFrameworkComponent('angular', 'tooltip');
  const dialog = service.getFrameworkComponent('angular', 'dialog');

  // Radix NG tooltip has no config provider; the previous registry entry
  // referenced the nonexistent `provideRdxTooltipConfig` from `tooltip2`.
  assert.equal(tooltip?.providers, undefined);

  assert.equal(typeof dialog?.providers?.import, 'string');
  assert.equal(typeof dialog?.providers?.function, 'string');
  assert.match(dialog.providers.function, /provideRdxDialogConfig/);

  console.log('PASS angular provider metadata');
}

async function testLegacyRegistryDirCompatibility(service) {
  await withTempProject('registry-service', async (targetDir) => {
    const registriesDir = path.join(targetDir, 'registries');
    await mkdir(registriesDir, { recursive: true });

    const registry = {
      name: 'react',
      components: {
        alpha: {
          name: 'Alpha',
          type: 'form',
          description: 'alpha component',
          files: ['Alpha.tsx'],
          dependencies: ['react'],
          devDependencies: [],
          peerDependencies: [],
          registryDependencies: ['beta'],
          category: 'form',
        },
        beta: {
          name: 'Beta',
          type: 'form',
          description: 'beta component',
          files: ['Beta.tsx'],
          dependencies: [],
          devDependencies: [],
          peerDependencies: [],
          registryDependencies: [],
          category: 'form',
        },
      },
      groups: {
        forms: {
          name: 'Forms',
          components: ['alpha', 'beta'],
        },
      },
    };

    const blocks = {
      name: 'react-blocks',
      components: {
        layout: {
          name: 'Layout',
          type: 'block',
          description: 'layout block',
          files: ['Layout.tsx'],
          dependencies: [],
          devDependencies: [],
          peerDependencies: [],
          registryDependencies: [],
          category: 'blocks',
        },
      },
      groups: {
        blocks: {
          name: 'Blocks',
          components: ['layout'],
        },
      },
    };

    await writeFile(
      path.join(registriesDir, 'registry-react.json'),
      JSON.stringify(registry, null, 2),
    );
    await writeFile(
      path.join(registriesDir, 'blocks-react.json'),
      JSON.stringify(blocks, null, 2),
    );

    service.clearFrameworkRegistryCache();

    const loaded = service.loadFrameworkRegistry('react', {
      registryDir: targetDir,
    });
    assert.equal(typeof loaded.components.alpha, 'object');
    assert.equal(typeof loaded.components.layout, 'object');

    const validation = service.validateFrameworkComponentDependencies(
      'react',
      'alpha',
      {
        registryDir: targetDir,
      },
    );
    assert.deepEqual(validation, { valid: true, missing: [] });

    const groupComponents = service.getFrameworkComponentsByGroup(
      'react',
      'forms',
      {
        registryDir: targetDir,
      },
    );
    assert.deepEqual(
      groupComponents.map((component) => component.name),
      ['Alpha', 'Beta'],
    );
  });

  console.log('PASS legacy registry dir compatibility');
}

async function main() {
  const service = await import('../dist/utils/framework-registry-service.js');

  await testFrameworkAliasMapping(service);
  await testDependencyGraphResolution(service);
  await testAngularProviderMetadata(service);
  await testLegacyRegistryDirCompatibility(service);

  console.log('framework registry service regression checks passed');
}

await main();
