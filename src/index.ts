export * from './commands/init.js';
export * from './commands/add.js';
export * from './commands/migrate-tailwind.js';
export {
  detectFramework,
  detectPackageManager,
  hasSrcDirectory,
  isGalaxyInitialized,
  isTailwindInstalled,
  type Framework as DetectedFramework,
  type PackageManager as DetectedPackageManager,
} from './utils/detect.js';
export {
  copyComponentFiles,
  ensureDir,
  fileExists,
  getComponentPath as getProjectComponentPath,
  getUtilsPath,
  readFile,
  writeFile,
} from './utils/files.js';
export * from './utils/registry.js';
export * from './utils/components-config.js';
export * from './utils/config-schema.js';
export * from './utils/tailwind-detector.js';
export * from './utils/tailwind-scaffold.js';
export * from './utils/tailwind-migration.js';
