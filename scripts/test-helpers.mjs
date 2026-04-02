import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const designRepoRoot = path.resolve(projectRoot, '..', 'galaxy-design');

export async function withTempProject(name, callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), `galaxy-${name}-`));
  await mkdir(path.join(root, 'src', 'components'), { recursive: true });
  return callback(root);
}

export function installFetchFromRepoSource() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const parsed = new URL(url);
    const repoRootIndex = parsed.pathname.indexOf('/packages/');

    if (repoRootIndex === -1) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      };
    }

    const relativeFilePath = decodeURIComponent(
      parsed.pathname.slice(repoRootIndex + 1),
    );
    const sourceFile = path.join(designRepoRoot, relativeFilePath);

    if (!existsSync(sourceFile)) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => readFile(sourceFile, 'utf-8'),
    };
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

export function install404Fetch() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    text: async () => '',
  });

  return () => {
    globalThis.fetch = originalFetch;
  };
}
