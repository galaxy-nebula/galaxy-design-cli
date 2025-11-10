import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Supported platforms for Galaxy UI CLI
 */
export type Platform = 'react-native' | 'flutter' | 'vue' | 'react' | 'angular' | 'nextjs' | 'nuxtjs' | 'unknown';

/**
 * Platform detection result with confidence level
 */
export interface PlatformDetectionResult {
	platform: Platform;
	confidence: 'high' | 'medium' | 'low';
	evidence: string[];
	framework?: string; // For web platforms: vue, react, angular
}

/**
 * Detect project platform based on file structure and config files
 *
 * Detection priority:
 * 1. Mobile platforms (React Native, Flutter) - highest priority
 * 2. Web frameworks (Vue, React, Angular)
 * 3. Unknown
 */
export function detectPlatform(cwd: string): PlatformDetectionResult {
	const evidence: string[] = [];

	// Check for Flutter (highest priority for mobile)
	if (existsSync(join(cwd, 'pubspec.yaml'))) {
		evidence.push('Found pubspec.yaml (Flutter project file)');

		// Additional Flutter indicators
		if (existsSync(join(cwd, 'lib'))) {
			evidence.push('Found lib/ directory (Flutter source directory)');
		}
		if (existsSync(join(cwd, 'android')) && existsSync(join(cwd, 'ios'))) {
			evidence.push('Found android/ and ios/ directories (Flutter mobile platforms)');
		}

		return {
			platform: 'flutter',
			confidence: 'high',
			evidence,
		};
	}

	// Check for React Native
	const hasPackageJson = existsSync(join(cwd, 'package.json'));
	const hasIosDir = existsSync(join(cwd, 'ios'));
	const hasAndroidDir = existsSync(join(cwd, 'android'));
	const hasAppJson = existsSync(join(cwd, 'app.json'));

	if (hasPackageJson && (hasIosDir || hasAndroidDir)) {
		evidence.push('Found package.json with mobile platform directories');

		if (hasIosDir) evidence.push('Found ios/ directory');
		if (hasAndroidDir) evidence.push('Found android/ directory');
		if (hasAppJson) evidence.push('Found app.json (React Native config)');

		// Check package.json for react-native dependency
		try {
			const packageJson = require(join(cwd, 'package.json'));
			if (packageJson.dependencies?.['react-native']) {
				evidence.push('Found react-native in dependencies');
				return {
					platform: 'react-native',
					confidence: 'high',
					evidence,
				};
			}
		} catch (error) {
			// Ignore JSON parse errors
		}

		// If has mobile dirs but no react-native dep, still consider it RN with medium confidence
		return {
			platform: 'react-native',
			confidence: 'medium',
			evidence,
		};
	}

	// Check for Web frameworks (only if not mobile)
	if (hasPackageJson) {
		try {
			const packageJson = require(join(cwd, 'package.json'));
			const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

			// Check for Next.js (must be before React check)
			if (deps['next']) {
				evidence.push('Found Next.js in dependencies');
				if (existsSync(join(cwd, 'next.config.js')) || existsSync(join(cwd, 'next.config.ts'))) {
					evidence.push('Found next.config (Next.js config)');
				}
				return {
					platform: 'nextjs',
					confidence: 'high',
					evidence,
					framework: 'nextjs',
				};
			}

			// Check for Nuxt.js (must be before Vue check)
			if (deps['nuxt'] || deps['nuxt3']) {
				evidence.push('Found Nuxt.js in dependencies');
				if (existsSync(join(cwd, 'nuxt.config.ts')) || existsSync(join(cwd, 'nuxt.config.js'))) {
					evidence.push('Found nuxt.config (Nuxt.js config)');
				}
				return {
					platform: 'nuxtjs',
					confidence: 'high',
					evidence,
					framework: 'nuxtjs',
				};
			}

			// Check for Vue
			if (deps['vue'] || deps['@vue/cli']) {
				evidence.push('Found Vue in dependencies');
				if (existsSync(join(cwd, 'vite.config.ts')) || existsSync(join(cwd, 'vite.config.js'))) {
					evidence.push('Found vite.config (Vue + Vite)');
				}
				return {
					platform: 'vue',
					confidence: 'high',
					evidence,
					framework: 'vue',
				};
			}

			// Check for Angular
			if (deps['@angular/core']) {
				evidence.push('Found @angular/core in dependencies');
				if (existsSync(join(cwd, 'angular.json'))) {
					evidence.push('Found angular.json (Angular config)');
				}
				return {
					platform: 'angular',
					confidence: 'high',
					evidence,
					framework: 'angular',
				};
			}

			// Check for React (web)
			if (deps['react'] && !hasIosDir && !hasAndroidDir) {
				evidence.push('Found React in dependencies (web project)');
				if (existsSync(join(cwd, 'vite.config.ts')) || existsSync(join(cwd, 'vite.config.js'))) {
					evidence.push('Found vite.config (React + Vite)');
				}
				return {
					platform: 'react',
					confidence: 'high',
					evidence,
					framework: 'react',
				};
			}
		} catch (error) {
			// Ignore errors
		}
	}

	// Unknown platform
	return {
		platform: 'unknown',
		confidence: 'low',
		evidence: ['No recognized project structure found'],
	};
}

/**
 * Get human-readable platform name
 */
export function getPlatformDisplayName(platform: Platform): string {
	const names: Record<Platform, string> = {
		'react-native': 'React Native',
		'flutter': 'Flutter',
		'vue': 'Vue.js',
		'react': 'React',
		'angular': 'Angular',
		'nextjs': 'Next.js',
		'nuxtjs': 'Nuxt.js',
		'unknown': 'Unknown',
	};
	return names[platform];
}

/**
 * Check if platform is mobile
 */
export function isMobilePlatform(platform: Platform): boolean {
	return platform === 'react-native' || platform === 'flutter';
}

/**
 * Check if platform is web
 */
export function isWebPlatform(platform: Platform): boolean {
	return platform === 'vue' || platform === 'react' || platform === 'angular' || platform === 'nextjs' || platform === 'nuxtjs';
}

/**
 * Get registry file name for platform
 */
export function getRegistryFileName(platform: Platform): string {
	switch (platform) {
		case 'react-native':
			return 'registry-react-native.json';
		case 'flutter':
			return 'registry-flutter.json';
		case 'vue':
		case 'nuxtjs':
		case 'react':
		case 'nextjs':
		case 'angular':
			return 'registry.json'; // Web platforms use same registry
		default:
			return 'registry.json';
	}
}

/**
 * Get component source directory for platform
 */
export function getComponentSourceDir(platform: Platform): string {
	switch (platform) {
		case 'react-native':
			return 'packages/react-native/src/components';
		case 'flutter':
			return 'packages/flutter/lib/components';
		case 'vue':
		case 'nuxtjs':
			return 'packages/vue/src/components';
		case 'react':
		case 'nextjs':
			return 'packages/react/src/components';
		case 'angular':
			return 'packages/angular/src/components';
		default:
			throw new Error(`Unknown platform: ${platform}`);
	}
}
