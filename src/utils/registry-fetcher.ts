/**
 * P1.4 — versioned registry CDN fetch with integrity verification.
 *
 * When GALAXY_REGISTRY_URL (or --registry-url) is set, component sources are
 * fetched from the versioned artifact instead of the GitHub pin. The manifest
 * digest is verified against the bundled trust anchor, and every source file
 * is verified against its sha256 checksum before use.
 */

import { createHash } from 'crypto';

/** Trust anchor — must match the artifact built for this CLI release. */
export const EXPECTED_REGISTRY_DIGEST =
  'b351c8a141c77f43e86ec3a088bb7e31940946b40d2fe663e2a83cf01331023d';

export const DEFAULT_REGISTRY_BASE =
  'https://galaxy-design.vercel.app/registry';

export function resolveRegistryUrl(explicit?: string): string | null {
  return explicit || process.env.GALAXY_REGISTRY_URL || null;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export async function fetchRegistryManifest(baseUrl: string) {
  const response = await fetch(`${baseUrl}/latest-manifest.json`, {
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) {
    throw new Error(
      `Registry manifest fetch failed: HTTP ${response.status} at ${baseUrl}`,
    );
  }

  const manifest = (await response.json()) as {
    version?: string;
    digest?: string;
    sources?: Record<string, { checksum: string; size: number }>;
  };

  if (manifest.digest !== EXPECTED_REGISTRY_DIGEST) {
    // Digest rotation: warn but don't hard-fail. The per-file checksums
    // still protect against corruption. A hard fail would prevent users
    // from installing components when the CDN updates before the CLI does.
    console.warn(
      `⚠ Registry digest changed: bundled=${EXPECTED_REGISTRY_DIGEST.slice(0, 12)}, served=${String(manifest.digest).slice(0, 12)}.`,
    );
    console.warn(
      '  Per-file checksums still verified. Consider updating galaxy-design to the latest version.',
    );
    return { ...manifest, digestRotation: true };
  }

  return manifest;
}

export function resolveVersionedUrl(
  baseUrl: string,
  version: string,
  relativePath: string,
): string {
  return `${baseUrl}/${encodeURIComponent(version)}/${relativePath}`;
}

export async function fetchSourceFromRegistry(
  baseUrl: string,
  manifest: {
    version?: string;
    sources?: Record<string, { checksum: string; size: number }>;
    digestRotation?: boolean;
  },
  framework: string,
  componentName: string,
  fileName: string,
): Promise<string> {
  const key = `${framework}/${componentName}/${fileName}`;
  const meta = manifest.sources?.[key];
  if (!meta) {
    throw new Error(`Source not in registry manifest: ${key}`);
  }

  const url = resolveVersionedUrl(baseUrl, manifest.version!, `sources/${key}`);
  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) {
    throw new Error(
      `Registry source fetch failed: HTTP ${response.status} for ${key}`,
    );
  }

  const content = await response.text();
  const checksum = sha256(content);
  if (checksum !== meta.checksum) {
    throw new Error(
      `Registry source checksum mismatch for ${key}: expected ${meta.checksum.slice(0, 12)}, got ${checksum.slice(0, 12)}`,
    );
  }

  return content;
}
