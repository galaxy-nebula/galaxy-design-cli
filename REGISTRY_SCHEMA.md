# Registry Schema

Galaxy CLI now treats registry data as two separate layers:

## `registry.json`

Purpose: discovery and catalog metadata for AI/tooling.

Required fields per component:
- `name`
- `type`
- `description`
- `category`
- `frameworks`

Recommended usage:
- Use this file to know a component exists.
- Use `frameworks` to know where it is supported.
- Treat `props` and `children` as optional summary metadata, not installation source-of-truth.

Schema:
- `src/schemas/registry-summary-schema.json`

## `registry-<framework>.json`

Purpose: framework-specific source-of-truth.

Required fields per component:
- `name`
- `type`
- `description`
- `files`
- `dependencies`
- `devDependencies`
- `registryDependencies`
- `category`

Recommended usage:
- Use these files for component installation, file copying, and dependency resolution.
- Prefer these files over `registry.json` when exact framework behavior matters.

Schema:
- `src/schemas/registry-framework-schema.json`

## Normalized APIs

Some components exist in multiple frameworks but are backed by different libraries. In those cases, the preferred approach is:

1. Define a shared conceptual API first.
2. Keep framework registries as the source of truth for actual implementation details.
3. Document framework-only differences explicitly instead of silently diverging.

This is especially important for AI/codegen tooling because it needs both:
- a common surface for planning
- a framework-specific surface for final code generation

### Recommended shape

For multi-framework components, treat props in two buckets:

- `common`: props intentionally normalized across frameworks
- `framework-specific`: props exposed only by a specific framework implementation

The current JSON files still store a flat `props` list for compatibility, but when authoring new mappings the intended rule is:
- include the normalized/common props first
- then add any framework-specific props only where needed
- describe limitations in the prop description when one framework cannot fully support the shared model

### `resizable` example

Preferred normalized model:

- `ResizablePanelGroup`
  - `direction`
  - `autoSaveId`
  - `keyboardResizeBy`
  - `onLayout`
  - `className` / `class`
- `ResizablePanel`
  - `defaultSize`
  - `minSize`
  - `maxSize`
  - `collapsedSize`
  - `collapsible`
  - `order`
  - `className` / `class`
- `ResizableHandle`
  - `disabled`
  - `withHandle`
  - `className` / `class`

Preferred implementation libraries for alignment:
- React: `react-resizable-panels`
- Vue: `Radix Vue Splitter`
- Angular: `angular-split`

## Current rule

- `registry.json` is the summary catalog.
- `registry-react.json`, `registry-vue.json`, `registry-angular.json`, `registry-react-native.json`, and `registry-flutter.json` are the detailed registries.
- `nextjs` support is inferred from `react`.
- `nuxtjs` support is inferred from `vue`.

## Transition note

`registry.json` still contains some detailed prop metadata for backward compatibility. New tooling should treat framework registries as the authoritative detail layer.
