export type {
  FrameworkComponentGroup,
  FrameworkRegistry,
  FrameworkRegistryComponent as FrameworkComponent,
  FrameworkComponentProvider,
  RegistryFramework,
  RegistryTarget,
} from './framework-registry-service.js';
export {
  clearFrameworkRegistryCache as clearRegistryCache,
  frameworkComponentExists,
  getAllFrameworkComponents,
  getAllFrameworkGroups,
  getFrameworkComponent,
  getFrameworkComponentDependencies,
  getFrameworkComponentsByGroup,
  getFrameworkComponentsByType,
  loadFrameworkRegistry,
  resolveFrameworkComponentGraph,
  resolveFrameworkComponentName,
  validateFrameworkComponentDependencies,
} from './framework-registry-service.js';
