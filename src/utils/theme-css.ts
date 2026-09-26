/**
 * @author Bùi Trọng Hiếu
 * @email kevinbui210191@gmail.com
 * @desc Build global stylesheet content from theme preset vars
 */

/** Full Tailwind v4 semantic bridge. init must emit every token the components use. */
export const TAILWIND_V4_THEME_BRIDGE = `@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}`;

export function buildCSSFromVars(light: string, dark: string, mode: 'v3' | 'v4'): string {
  if (mode === 'v4') {
    return `@import "tailwindcss";
@import "tw-animate-css";

${TAILWIND_V4_THEME_BRIDGE}

:root {
  ${light}
}

.dark {
  ${dark}
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;
  }

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  ${light}
}

.dark {
  ${dark}
}
`;
}
