# Nebula CLI

[![npm version](https://img.shields.io/npm/v/@galaxy-stack/nebula-cli.svg)](https://www.npmjs.com/package/@galaxy-stack/nebula-cli)
[![npm downloads](https://img.shields.io/npm/dm/@galaxy-stack/nebula-cli.svg)](https://www.npmjs.com/package/@galaxy-stack/nebula-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

CLI for initializing [Galaxy UI](https://galaxy-design.vercel.app) and copying framework-specific components (67 components × 5 frameworks: React, Vue, Angular, React Native, Flutter) into your project.

## Features

- Commands: `init`, `add`, `list`, `doctor`, `diff`, `update`, `migrate tailwind`
- Detects React, Next.js, Vue, Nuxt.js, and Angular projects
- Stores project settings in `components.json`
- Scaffolds Tailwind in v4-first mode while preserving existing v3 projects
- Copies components into your source tree so they remain editable
- Fails clearly when remote component files cannot be fetched
- Theme presets: `init --theme violet|green|blue|default`
- Integrity-verified registry CDN (sha256 per file + release digest)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) — current version **1.0.0** (Nebula milestone).

## Framework Mapping

`nextjs` and `nuxtjs` are CLI target frameworks, not separate published component packages.

- `nextjs` reuses the React source registry and adds Next-specific transforms such as `'use client'` when required
- `nuxtjs` reuses the Vue source registry and keeps Vue/Nuxt-specific file structure intact

That means the package/source-of-truth layer is still React for Next.js and Vue for Nuxt.js, while the CLI adapts the copied files for the target app.

## Installation

```bash
npx @galaxy-stack/nebula-cli@latest init
```

Or install globally:

```bash
npm install -g @galaxy-stack/nebula-cli
bun add -g @galaxy-stack/nebula-cli
```

## Quick Start

### 1. Initialize

```bash
npx @galaxy-stack/nebula-cli@latest init
```

`init` currently does the following:

- Detects the framework
- Creates `components.json`
- Installs core dependencies
- Creates `components/ui` and the `cn()` utility
- Detects Tailwind v3/v4 and scaffolds the matching mode

Tailwind behavior:

- Existing Tailwind v3 project: stays on v3
- Existing Tailwind v4 project: stays on v4
- No Tailwind detected: installs/scaffolds v4 by default

### 1.5 Migrate Tailwind v3 To v4

```bash
npx @galaxy-stack/nebula-cli@latest migrate tailwind --dry-run
npx @galaxy-stack/nebula-cli@latest migrate tailwind --yes
```

`migrate tailwind` currently focuses on the safe scaffold layer:

- Detects whether the current project still uses Tailwind v3
- Rewrites the global CSS entry from `@tailwind ...` directives to `@import "tailwindcss";`
- Rewrites the PostCSS config to use `@tailwindcss/postcss`
- Updates `components.json` Tailwind version metadata when present
- Reports utility classes that may need manual review in Tailwind v4

It does not try to auto-rewrite every potentially breaking utility class.

### 2. Add Components

```bash
# Add one component
npx @galaxy-stack/nebula-cli@latest add button

# Add several components
npx @galaxy-stack/nebula-cli@latest add button input card

# Interactive selection
npx @galaxy-stack/nebula-cli@latest add

# Add everything in the current registry
npx @galaxy-stack/nebula-cli@latest add --all
```

## Available Components

### 🎨 Form Components (9)

- `button` - Versatile button with variants and sizes
- `input` - Text input with label and validation states
- `checkbox` - Checkbox with indeterminate state
- `radio-group` - Radio button groups
- `select` - Dropdown select with search
- `slider` - Range slider input
- `switch` - Toggle switch
- `textarea` - Multi-line text input
- `label` - Accessible form labels

### 📐 Layout Components (4)

- `separator` - Horizontal/vertical divider
- `accordion` - Collapsible content sections
- `collapsible` - Single collapsible panel
- `tabs` - Tabbed content organization

### 🧭 Navigation Components (4)

- `navigation-menu` - Complex navigation with dropdowns
- `menubar` - Desktop-style menu bar
- `context-menu` - Right-click context menus
- `dropdown-menu` - Action dropdown menus

### 🔔 Overlay Components (5)

- `dialog` - Modal dialogs
- `alert-dialog` - Confirmation dialogs
- `popover` - Floating content containers
- `tooltip` - Hover tooltips
- `hover-card` - Preview cards on hover

### 📊 Data Display Components (6)

- `avatar` - User avatars with fallbacks
- `progress` - Progress bars and indicators
- `table` - Data tables with sorting
- `pagination` - Page navigation
- `empty` - Empty state placeholders
- `skeleton` - Loading skeletons

### ✍️ Typography & Utilities (2)

- `typography` - Text styles and components
- `kbd` - Keyboard shortcut display

### 📅 Date & Time Components (2)

- `calendar` - Date picker calendar
- `calendar-range` - Date range picker

### ⚡ Advanced Components (4)

- `command` - Command palette (⌘K)
- `sheet` - Slide-out panels
- `toolbar` - Action toolbars
- `tags-input` - Multi-value tag input

### 🎁 Bonus Components (5)

- `aspect-ratio` - Aspect ratio container
- `badge` - Status badges and labels
- `card` - Content cards
- `scroll-area` - Custom scrollbars
- `toggle` - Toggle buttons
- `toggle-group` - Toggle button groups

## Framework Examples

### React

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function MyComponent() {
  return (
    <div>
      <Button variant="default" size="lg">
        Click me
      </Button>
      <Input placeholder="Enter text..." />
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
</script>

<template>
  <div>
    <Button variant="default" size="lg">Click me</Button>
    <Input placeholder="Enter text..." />
  </div>
</template>
```

### Angular

```typescript
import { Component } from '@angular/core';
import { ButtonDirective } from '@/components/ui/button';
import { InputComponent } from '@/components/ui/input';

@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [ButtonDirective, InputComponent],
  template: `
    <div>
      <button hlmBtn variant="default" size="lg">Click me</button>
      <hlm-input placeholder="Enter text..." />
    </div>
  `,
})
export class MyComponent {}
```

### Next.js

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function MyComponent() {
  return (
    <div>
      <Button variant="default" size="lg">
        Click me
      </Button>
      <Input placeholder="Enter text..." />
    </div>
  );
}
```

`add` automatically preserves framework-specific transformations such as `'use client'` for Next.js components when needed.

Next.js support is implemented as a React-source target inside the CLI, not as a separate `@galaxy-ui/nextjs` package.

### Nuxt.js

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
</script>

<template>
  <div>
    <Button variant="default" size="lg">Click me</Button>
    <Input placeholder="Enter text..." />
  </div>
</template>
```

Nuxt users should make sure the `@/` alias is available in `nuxt.config.ts`.

Nuxt.js support is implemented as a Vue-source target inside the CLI, not as a separate `@galaxy-ui/nuxtjs` package.

## Configuration

Galaxy UI stores project settings in `components.json`:

```json
{
  "$schema": "https://galaxy-design.vercel.app/schema.json",
  "framework": "react",
  "typescript": true,
  "tailwind": {
    "version": 4,
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib"
  },
  "iconLibrary": "lucide"
}
```

## Configuration Options

| Option               | Description            | Default            |
| -------------------- | ---------------------- | ------------------ |
| `framework`          | Your framework         | Auto-detected      |
| `typescript`         | Use TypeScript         | `true`             |
| `tailwind.version`   | Tailwind major version | Auto-detected      |
| `tailwind.config`    | Tailwind config path   | Framework-specific |
| `tailwind.css`       | Global CSS file        | Framework-specific |
| `tailwind.baseColor` | Base color scheme      | `slate`            |
| `aliases.components` | Components alias       | `@/components`     |
| `aliases.utils`      | Utils alias            | `@/lib/utils`      |
| `iconLibrary`        | Icon library to use    | `lucide`           |

## CLI Commands

### `init`

Initialize Galaxy UI in your project and scaffold `components.json`.

```bash
npx @galaxy-stack/nebula-cli@latest init

# Skip prompts (use defaults)
npx @galaxy-stack/nebula-cli@latest init --yes
```

### `add`

Add registry components to your project.

```bash
# Interactive mode
npx @galaxy-stack/nebula-cli@latest add

# Add specific components
npx @galaxy-stack/nebula-cli@latest add button input

# Add all components
npx @galaxy-stack/nebula-cli@latest add --all
```

There is currently no `diff` command and no `--overwrite` option on `add`.

## Styling And Theming

Galaxy UI uses Tailwind CSS with CSS variables for theming. After running `init`, you can customize colors in your CSS file:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    /* ... more variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode variables */
  }
}
```

## Customization

Components are copied to your project, so you have full control:

1. **Modify components** - Edit any component in `components/ui/`
2. **Change styles** - Update Tailwind classes or CSS variables
3. **Add features** - Extend components with your own functionality
4. **No lock-in** - Components are yours to modify

## Documentation

- Docs Website: <https://galaxy-design.vercel.app>
- Repository: <https://github.com/galaxy-nebula/galaxy-design-cli>

## Notes

- `add` currently fetches component source files from GitHub at runtime.
- The CLI now fails explicitly if required files cannot be fetched.
- `components.json` is the active configuration system. Legacy `galaxy.config.*` flow has been removed from source.

## License

MIT License - see [LICENSE](../../LICENSE) for details
