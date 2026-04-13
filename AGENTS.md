# AGENTS.md - ains.art

## Build & Development Commands

```bash
# Development server (http://localhost:4321)
bun run dev

# Production build
bun run build

# Preview production build
bun run preview

# TypeScript type checking
bunx astro check

# Code formatting
bunx prettier --write .
```

## Project Structure

- **Framework**: Astro 5.x with React 19 integration
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Package Manager**: Bun
- **TypeScript**: Strict mode enabled via `astro/tsconfigs/strict`

```
src/
  components/     # React & Astro components
    ui/          # shadcn/ui components (Button, Badge, etc.)
  layouts/        # Astro layouts (main.astro, page.astro, profile.astro)
  pages/          # Astro route pages
  lib/           # Utility functions
  styles/        # Global CSS with Tailwind v4
public/          # Static assets
```

## Code Style Guidelines

### TypeScript

- Use strict TypeScript with explicit types
- Prefer `type` over `interface` for object shapes
- Use path aliases: `@/components`, `@/lib/utils`
- Temporal API for dates: `@js-temporal/polyfill`

### Imports

- React imports: `import * as React from "react"` or named imports
- Group imports: React → libraries → components → utils → styles
- Use `@/` aliases for internal imports
- CSS imports at end: `import 'leaflet/dist/leaflet.css'`

### Naming Conventions

- Components: PascalCase (`Button.tsx`, `Header.astro`)
- Utilities: camelCase (`cn.ts`)
- Files: kebab-case for Astro, PascalCase for React
- CSS classes: Tailwind utility-first, no custom CSS unless necessary

### Component Patterns

- React components: Function declarations with explicit return types
- Props: Destructure with defaults in function parameters
- Astro components: Use `---` frontmatter for imports/scripts
- Client hydration: Use `client:only="react"` for React components

### Styling

- Tailwind v4 with `@theme` for custom CSS variables
- shadcn/ui "new-york" style
- Color system: CSS variables in `global.css` (light/dark modes)
- Custom variants via `class-variance-authority` (CVA)
- Icons: Lucide React

### Error Handling

- Use optional chaining (`?.`) for nullable access
- Type guards for runtime checks
- No try/catch unless explicitly needed

### State Management

- React hooks: `useState`, `useRef`, `useEffect`, `useCallback`
- Mutable refs for persistent state between renders
- Force update pattern: `const [, forceUpdate] = useState(0)`

## shadcn/ui Conventions

Components follow shadcn/ui patterns:

- Base styles in component files using CVA
- Slot pattern for composition (`@radix-ui/react-slot`)
- `cn()` utility for class merging from `@/lib/utils`
- `data-slot`, `data-variant`, `data-size` attributes

## Debugging with Chrome DevTools MCP

Debug the running app at http://localhost:4321:

```javascript
// Navigate and inspect
chrome-devtools_navigate_page(url: "http://localhost:4321")
chrome-devtools_take_snapshot()

// Console and network
chrome-devtools_list_console_messages()
chrome-devtools_get_console_message(msgid: 1)
chrome-devtools_list_network_requests()

// Interactions
chrome-devtools_click(uid: "1_5")
chrome-devtools_hover(uid: "1_5")
chrome-devtools_fill(uid: "input_uid", value: "text")
chrome-devtools_press_key(key: "Enter")

// State inspection
chrome-devtools_evaluate_script(() => { return document.title })
```

## Debugging Workflow

1. Start dev server: `bun run dev`
2. Navigate: `chrome-devtools_navigate_page`
3. Inspect: `chrome-devtools_take_snapshot`
4. Check errors: `chrome-devtools_list_console_messages`
5. Test state: `chrome-devtools_evaluate_script`
6. Trigger behaviors: click, hover, fill

## Problem Solving Principles

- **Read first**: Understand existing code before changes
- **Ask questions**: Clarify requirements before implementation
- **Trace flow**: Follow data through components to find root causes
- **Verify with commands**: Test hypotheses with build/check commands
- **Be reluctant**: Don't build unless explicitly requested

---

_Last updated: 2026-04-13_
