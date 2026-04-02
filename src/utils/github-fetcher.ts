import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * GitHub repository configuration
 */
const GITHUB_CONFIG = {
  owner: 'buikevin',
  repo: 'galaxy-design',
  branch: 'main',
};

/**
 * Get GitHub raw content URL
 */
export function getGitHubRawUrl(filePath: string): string {
  const { owner, repo, branch } = GITHUB_CONFIG;
  const cacheBust = Date.now();
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}?v=${cacheBust}`;
}

function getCandidateFileNames(filePath: string): string[] {
  const segments = filePath.split('/');
  const fileName = segments.pop();

  if (!fileName) {
    return [filePath];
  }

  const candidates = [fileName];
  const capitalized = fileName.charAt(0).toUpperCase() + fileName.slice(1);

  if (!candidates.includes(capitalized)) {
    candidates.push(capitalized);
  }

  return candidates.map((candidate) => [...segments, candidate].join('/'));
}

/**
 * Fetch file content from GitHub
 *
 * @param filePath - Relative path in repository
 * @returns File content as string
 */
export async function fetchFileFromGitHub(filePath: string): Promise<string> {
  const errors: string[] = [];

  for (const candidatePath of getCandidateFileNames(filePath)) {
    const url = getGitHubRawUrl(candidatePath);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            errors.push(`404 ${candidatePath}`);
            break;
          }

          throw new Error(
            `Failed to fetch ${candidatePath}: ${response.status} ${response.statusText}`,
          );
        }

        return await response.text();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${candidatePath} (attempt ${attempt}): ${message}`);

        if (attempt === 2) {
          break;
        }
      }
    }
  }

  throw new Error(`GitHub fetch error: ${errors.join(' | ')}`);
}

/**
 * Fetch and save file from GitHub to local path
 *
 * @param sourceFilePath - Path in GitHub repository
 * @param targetFilePath - Local file path to save
 * @returns True if successful
 */
export async function fetchAndSaveFile(
  sourceFilePath: string,
  targetFilePath: string,
): Promise<boolean> {
  try {
    const content = await fetchFileFromGitHub(sourceFilePath);

    // Create directory if it doesn't exist
    const dir = dirname(targetFilePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write file
    writeFileSync(targetFilePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to fetch and save ${sourceFilePath}:`, error);
    return false;
  }
}

/**
 * Fetch multiple files from GitHub
 *
 * @param files - Array of { source: githubPath, target: localPath }
 * @returns Results for each file
 */
export async function fetchMultipleFiles(
  files: Array<{ source: string; target: string }>,
): Promise<Array<{ file: string; success: boolean; error?: string }>> {
  const results = await Promise.all(
    files.map(async ({ source, target }) => {
      try {
        const success = await fetchAndSaveFile(source, target);
        return {
          file: source,
          success,
          error: success ? undefined : 'Failed to fetch',
        };
      } catch (error) {
        return {
          file: source,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),
  );

  return results;
}

/**
 * Get component source path in GitHub repository
 *
 * @param platform - Platform (vue, react, angular, react-native, flutter)
 * @param componentName - Component name
 * @param fileName - File name
 * @returns GitHub repository path
 */
export function getComponentGitHubPath(
  platform: string,
  componentName: string,
  fileName: string,
  sourceType: 'components' | 'blocks' = 'components',
): string {
  // Map platform to package directory
  const platformMap: Record<string, string> = {
    vue: 'packages/vue/src',
    react: 'packages/react/src',
    angular: 'packages/angular/src',
    'react-native': 'packages/react-native/src',
    flutter: 'packages/flutter/lib',
  };

  const basePath = platformMap[platform] || `packages/${platform}/src`;
  return `${basePath}/${sourceType}/${componentName}/${fileName}`;
}

/**
 * Check if GitHub repository is accessible
 */
export async function checkGitHubConnection(): Promise<boolean> {
  try {
    const url = getGitHubRawUrl('README.md');
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
