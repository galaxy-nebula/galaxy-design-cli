# Galaxy UI CLI

A modern, framework-agnostic CLI tool for adding beautiful, accessible UI components to your projects. Inspired by shadcn/ui, but supporting React, Vue, and Angular.

## 🌟 Features

- 🚀 **Multi-framework support**: React, Vue, and Angular
- 📦 **41 production-ready components** across 8 categories
- 🎨 **Built with Radix UI primitives** (radix-ui for React, radix-vue for Vue, radix-ng for Angular)
- 🌙 **Dark mode support** out of the box
- 📱 **Responsive design** with mobile-first approach
- ♿ **Accessibility-focused** (WAI-ARIA compliant)
- 🎯 **TypeScript strict mode** support
- 💅 **Tailwind CSS** for styling
- 📝 **Customizable** - components are copied to your project

## 📦 Installation

```bash
# Using npx (recommended - no installation needed)
npx galaxy-ui-cli@latest init

# Or install globally
npm install -g galaxy-ui-cli
bun add -g galaxy-ui-cli
```

## 🚀 Quick Start

### 1. Initialize Galaxy UI in your project

```bash
npx galaxy-ui-cli@latest init
```

This interactive command will:

- ✅ Detect your framework (React, Vue, or Angular)
- ✅ Detect your package manager (npm, pnpm, yarn, or bun)
- ✅ Install required dependencies (lucide icons, clsx, tailwind-merge, radix primitives)
- ✅ Create component directory structure
- ✅ Setup Tailwind CSS configuration
- ✅ Create utility files (cn helper, etc.)

### 2. Add components

```bash
# Add single component
npx galaxy-ui-cli@latest add button

# Add multiple components
npx galaxy-ui-cli@latest add button input card

# Interactive mode (select from list)
npx galaxy-ui-cli@latest add
```

## 📚 Available Components (41 total)

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

## 🎯 Framework-Specific Examples

### React

```tsx
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

export function MyComponent() {
  return (
    <div>
      <Button variant="default" size="lg">
        Click me
      </Button>
      <Input placeholder="Enter text..." />
    </div>
  )
}
```

### Vue

```vue
<script setup lang="ts">
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
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
import {Component} from '@angular/core';
import {ButtonDirective} from '@/components/ui/button';
import {InputComponent} from '@/components/ui/input';

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

## ⚙️ Configuration

Galaxy UI stores configuration in `components.json` at your project root:

```json
{
  "$schema": "https://galaxy-ui.com/schema.json",
  "framework": "react",
  "typescript": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/app/globals.css",
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

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `framework` | Your framework (react/vue/angular) | Auto-detected |
| `typescript` | Use TypeScript | `true` |
| `tailwind.config` | Tailwind config path | `tailwind.config.js` |
| `tailwind.css` | Global CSS file | Framework-specific |
| `tailwind.baseColor` | Base color scheme | `slate` |
| `aliases.components` | Components alias | `@/components` |
| `aliases.utils` | Utils alias | `@/lib/utils` |
| `iconLibrary` | Icon library to use | `lucide` |

## 🔧 CLI Commands

### `init`

Initialize Galaxy UI in your project.

```bash
npx galaxy-ui-cli@latest init

# Skip prompts (use defaults)
npx galaxy-ui-cli@latest init --yes
```

### `add`

Add components to your project.

```bash
# Interactive mode
npx galaxy-ui-cli@latest add

# Add specific components
npx galaxy-ui-cli@latest add button input

# Add all components
npx galaxy-ui-cli@latest add --all

# Overwrite existing components
npx galaxy-ui-cli@latest add button --overwrite
```

### `diff`

Check which components have updates available.

```bash
npx galaxy-ui-cli@latest diff button
```

## 🌈 Styling & Theming

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

## 🎨 Customization

Components are copied to your project, so you have full control:

1. **Modify components** - Edit any component in `components/ui/`
2. **Change styles** - Update Tailwind classes or CSS variables
3. **Add features** - Extend components with your own functionality
4. **No lock-in** - Components are yours to modify

## 📖 Documentation & Examples

- **Live Examples**: Check `examples/` folder for complete React, Vue, and Angular apps
- **Docs Website**: <https://galaxy-ui-cli.vercel.app>
- **GitHub**: <https://github.com/buikevin/galaxy-ui-cli>

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md).

## 📝 License

MIT License - see [LICENSE](../../LICENSE) for details

## 🙏 Credits

- Inspired by [shadcn/ui](<https://ui.shadcn.com>)
- Built with [Radix UI](<https://radix-ui.com>), [Radix Vue](<https://radix-vue.com>), and [Spartan NG](<https://spartan.ng>)
- Icons from [Lucide](<https://lucide.dev>)
- Styling with [Tailwind CSS](<https://tailwindcss.com>)

---

**Made with ❤️ by the Galaxy UI team**

For issues and feature requests, please visit our [GitHub Issues](<https://github.com/buikevin/galaxy-ui-cli/issues>)
