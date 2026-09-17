/**
 * @author Bùi Trọng Hiếu
 * @email kevinbui210191@gmail.com
 * @desc Build global stylesheet content from theme preset vars
 */

export function buildCSSFromVars(light: string, dark: string, mode: 'v3' | 'v4'): string {
  if (mode === 'v4') {
    return `@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
}

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
