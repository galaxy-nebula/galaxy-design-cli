import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(projectRoot, 'src');
const outputRoot = resolve(projectRoot, 'dist');
const registryOutput = resolve(outputRoot, 'registries');

mkdirSync(registryOutput, { recursive: true });
copyFileSync(resolve(sourceRoot, 'registry.json'), resolve(outputRoot, 'registry.json'));

for (const framework of ['react', 'vue', 'angular', 'react-native', 'flutter']) {
  for (const kind of ['registry', 'blocks', 'assistant']) {
    const fileName = `${kind}-${framework}.json`;
    copyFileSync(
      resolve(sourceRoot, 'registries', fileName),
      resolve(registryOutput, fileName),
    );
  }
}

cpSync(resolve(sourceRoot, 'schemas'), resolve(outputRoot, 'schemas'), {
  recursive: true,
});
