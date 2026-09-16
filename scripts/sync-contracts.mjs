#!/usr/bin/env node
/**
 * Sync CLI framework registries from the canonical manifest artifacts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);
const generatedRoot = path.resolve(projectRoot, '..', 'galaxy-design', 'packages', 'contracts', 'generated');

const FRAMEWORKS = {
  react: 'registry-react.json',
  vue: 'registry-vue.json',
  angular: 'registry-angular.json',
  'react-native': 'registry-react-native.json',
  flutter: 'registry-flutter.json',
};

const BLOCK_CATEGORIES = new Set(['blocks', 'mobile-blocks', 'block']);

for (const [framework, fileName] of Object.entries(FRAMEWORKS)) {
  const targetPath = path.join(projectRoot, 'src', 'registries', fileName);
  const target = JSON.parse(readFileSync(targetPath, 'utf-8'));
  const generated = JSON.parse(
    readFileSync(path.join(generatedRoot, `registry-${framework}.json`), 'utf-8'),
  );

  const stripped = {};
  const blockComponents = {};

  for (const [id, entry] of Object.entries(generated.components)) {
    const clone = { ...entry };
    delete clone.entry;
    delete clone.status;
    delete clone.manifestStatus;
    clone.category = clone.category || 'other';
    stripped[id] = clone;
  }

  // Split into main registry vs blocks registry
  const mainComponents = {};
  for (const [id, entry] of Object.entries(stripped)) {
    if (BLOCK_CATEGORIES.has(entry.category)) {
      blockComponents[id] = entry;
    } else {
      mainComponents[id] = entry;
    }
  }

  const next = { ...target, components: mainComponents };
  writeFileSync(targetPath, JSON.stringify(next, null, 2) + '\n');

  // Update blocks registry
  const blocksFileName = fileName.replace('registry-', 'blocks-');
  const blocksPath = path.join(projectRoot, 'src', 'registries', blocksFileName);
  if (existsSync(blocksPath) && Object.keys(blockComponents).length > 0) {
    const blocksReg = JSON.parse(readFileSync(blocksPath, 'utf-8'));
    blocksReg.components = { ...blocksReg.components, ...blockComponents };
    writeFileSync(blocksPath, JSON.stringify(blocksReg, null, 2) + '\n');
  }

  console.log(`${framework}: ${Object.keys(mainComponents).length} main, ${Object.keys(blockComponents).length} blocks`);
}

console.log('CLI registries synced from manifest artifacts.');
