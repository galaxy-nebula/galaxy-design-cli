import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const schemaFilePath = path.join(
  projectRoot,
  'src',
  'schemas',
  'components-schema.json',
);

async function main() {
  const { createComponentsJsonSchema } =
    await import('../dist/utils/config-schema.js');
  const nextContent = `${JSON.stringify(createComponentsJsonSchema(), null, 2)}\n`;
  const checkOnly = process.argv.includes('--check');

  let currentContent = '';
  try {
    currentContent = await readFile(schemaFilePath, 'utf-8');
  } catch {
    currentContent = '';
  }

  if (checkOnly) {
    if (currentContent !== nextContent) {
      console.error(
        'components-schema.json is out of date. Run `npm run generate:components-schema`.',
      );
      process.exitCode = 1;
      return;
    }
    console.log('components-schema.json is up to date');
    return;
  }

  if (currentContent === nextContent) {
    console.log('components-schema.json already up to date');
    return;
  }

  await writeFile(schemaFilePath, nextContent, 'utf-8');
  console.log('Updated src/schemas/components-schema.json');
}

await main();
