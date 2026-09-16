#!/usr/bin/env node
/**
 * Sync CLI framework registries from the canonical manifest artifacts in
 * ../galaxy-design/packages/contracts/generated. Components are replaced
 * wholesale; group data and any unknown top-level keys are preserved.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);
const generatedRoot = path.resolve(
  projectRoot,
  '..',
  'galaxy-design',
  'packages',
  'contracts',
  'generated',
);

const FRAMEWORKS = {
  react: 'registry-react.json',
  vue: 'registry-vue.json',
  angular: 'registry-angular.json',
  'react-native': 'registry-react-native.json',
  flutter: 'registry-flutter.json',
};

for (const [framework, fileName] of Object.entries(FRAMEWORKS)) {
  const targetPath = path.join(projectRoot, 'src', 'registries', fileName);
  const target = JSON.parse(readFileSync(targetPath, 'utf-8'));
  const generated = JSON.parse(
    readFileSync(path.join(generatedRoot, `registry-${framework}.json`), 'utf-8'),
  );

  const previousIds = Object.keys(generated.components).sort();
  const nextIds = Object.keys(generated.components).sort();
  if (previousIds.join(',') !== nextIds.join(',')) {
    throw new Error(`component set drift for ${framework}`);
  }

  const stripped = {};
  for (const [id, entry] of Object.entries(generated.components)) {
    const clone = { ...entry };
    delete clone.entry;
    delete clone.status;
    delete clone.manifestStatus;
    stripped[id] = clone;
  }

  const next = {
    ...target,
    components: stripped,
  };

  writeFileSync(targetPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`${framework}: ${Object.keys(stripped).length} components`);
}

console.log('CLI registries synced from manifest artifacts.');
