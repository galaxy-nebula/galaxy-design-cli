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

/**
 * Fetch file content from GitHub
 *
 * @param filePath - Relative path in repository
 * @returns File content as string
 */
export async function fetchFileFromGitHub(filePath: string): Promise<string> {
	const url = getGitHubRawUrl(filePath);

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
				throw new Error(`File not found: ${filePath}`);
			}
			throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
		}

		return await response.text();
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`GitHub fetch error: ${error.message}`);
		}
		throw new Error(`Unknown error fetching ${filePath}`);
	}
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
): string {
	// Map platform to package directory
	const platformMap: Record<string, string> = {
		vue: 'packages/vue/src/components',
		react: 'packages/react/src/components',
		angular: 'packages/angular/src/components',
		'react-native': 'packages/react-native/src/components',
		flutter: 'packages/flutter/lib/components',
	};

	const basePath = platformMap[platform] || `packages/${platform}/src/components`;
	return `${basePath}/${componentName}/${fileName}`;
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
