# AGENTS.md - ains.art

Astro 5 + React 19 + Tailwind CSS 4 + shadcn/ui project. Event map and timeline visualization app.

## Commands

```bash
bun run dev        # Dev server on http://localhost:4321
bun run build      # Production build
bun run preview    # Preview production build

# TypeScript & formatting
bunx astro check             # Type check
bunx prettier --write .      # Format all files
bunx prettier --write <file> # Format single file
```

No test runner or ESLint is configured.

## Tech Stack

- **Framework**: Astro 5 with React islands (`client:only="react"`)
- **Styling**: Tailwind CSS 4 (`@theme`, `@import "tailwindcss"`)
- **UI**: shadcn/ui (radix-ui + class-variance-authority)
- **Gestures**: @use-gesture/react for drag, wheel, pinch
- **Maps**: Leaflet with custom `divIcon` markers
- **Time**: @js-temporal/polyfill for date/time handling
- **Format**: Prettier with prettier-plugin-astro and prettier-plugin-tailwindcss

## Code Style

### Formatting

- No semicolons at end of statements
- Double quotes for strings
- 2 spaces indentation
- Trailing commas in objects/arrays
- Run `bunx prettier --write .` before committing

### Imports

```typescript
// React hooks first
import { useState, useRef, useCallback } from "react";

// Third-party libraries
import { Temporal } from "@js-temporal/polyfill";
import L from "leaflet";

// Internal aliases (@/* maps to ./src/*)
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// CSS imports (Astro files only)
import "../styles/global.css";
```

### Naming Conventions

- **Components**: PascalCase (e.g., `App.tsx`, `Button.tsx`)
- **Utilities**: camelCase (e.g., `cn.ts`, `utils.ts`)
- **Pages**: kebab-case or `index.astro`
- **Classes**: PascalCase (e.g., `TimeBadge`, `EventBadge`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MS_PER_DAY`)
- **Types/Interfaces**: PascalCase with descriptive names
- **Boolean props**: Prefix with `is` or `has` (e.g., `asChild`)

### TypeScript

- Strict mode enabled (`astro/tsconfigs/strict`)
- Use `type` for type aliases, `interface` for object shapes
- Explicit return types on exported functions
- Path aliases: `@/components`, `@/lib/utils`, etc.
- Use `readonly` for immutable properties

### Component Patterns

```typescript
// Function components with inferred return type
function Button({ className, variant = "default", ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />
}

// Export at bottom
export { Button, buttonVariants }
```

#### cva Pattern

```typescript
const buttonVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
    },
    size: {
      default: "h-9 px-4",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
```

#### Astro Components

```astro
---
import '../styles/global.css'
const { content } = Astro.props
---

<element class="tailwind-classes">
  <slot />
</element>
```

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── App.tsx          # Main React app
│   ├── Header.astro
│   └── Footer.astro
├── layouts/
│   ├── main.astro       # Base HTML layout
│   ├── page.astro
│   └── profile.astro
├── lib/
│   └── utils.ts         # cn() utility
├── pages/
│   └── index.astro      # Homepage
└── styles/
    └── global.css       # Tailwind v4 config + theme
```

## Key Patterns

### State Management

- Use refs for mutable state that doesn't trigger re-renders (timeline, map)
- Use `forceUpdate` pattern for imperative re-renders
- Separate visual state from data state

### Event Handling

- Use `@use-gesture/react` for complex gestures (drag, wheel, pinch)
- Use `useCallback` for event handlers passed to gesture hooks
- Prefer refs over state for high-frequency updates

### shadcn/ui

- Located in `src/components/ui/`
- Use `cva` for variant management
- Export component and variants separately
- Use `cn()` utility for class merging

### Tailwind CSS v4

- Use `@theme` for custom color definitions
- Custom CSS variables in `:root` and `.dark`
- OKLCH color format preferred
- Dark mode uses `.dark` class on `<html>` element

## Important Notes

- **No tests** - this project has no test runner configured
- **No ESLint** - relies on Prettier for formatting
- Tailwind CSS v4 uses `@theme` syntax (no `tailwind.config.js`)
- Astro config uses `trailingSlash: "never"`

---

_Last updated: 2026-04-21_
