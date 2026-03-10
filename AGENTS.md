# AGENTS.md - ains.art

## Debugging with Chrome DevTools MCP

Use the Chrome DevTools MCP to debug the running app at http://localhost:4321

### Useful Commands

```javascript
// Navigate to the app
chrome-devtools_navigate_page(url: "http://localhost:4321")

// Take a snapshot to see the page structure
chrome-devtools_take_snapshot()

// List console messages
chrome-devtools_list_console_messages()

// Get a specific console message
chrome-devtools_get_console_message(msgid: 1)

// Evaluate JavaScript in the page context
chrome-devtools_evaluate_script(() => { return document.title })

// List network requests
chrome-devtools_list_network_requests()

// Get network request details
chrome-devtools_get_network_request(reqid: 1)

// Click an element (use uid from snapshot)
chrome-devtools_click(uid: "1_5")

// Hover over an element
chrome-devtools_hover(uid: "1_5")

// Fill a form input
chrome-devtools_fill(uid: "input_uid", value: "text")

// Press a key
chrome-devtools_press_key(key: "Enter")

// Take a screenshot
chrome-devtools_take_screenshot(filePath: "screenshot.png")

// Navigate back/forward
chrome-devtools_navigate_page(type: "back")
chrome-devtools_navigate_page(type: "forward")

// Reload the page
chrome-devtools_navigate_page(type: "reload")
```

### Debugging Workflow

1. Start the dev server: `bun run dev`
2. Use `chrome-devtools_navigate_page` to open the app
3. Use `chrome-devtools_take_snapshot` to inspect the DOM
4. Use `chrome-devtools_list_console_messages` to check for errors
5. Use `chrome-devtools_evaluate_script` to read/set window state or test hypotheses
6. Use interactions (click, hover, fill) to trigger behaviors

---

## Debugging & Problem Solving

- **Read code first** - don't guess, understand what's happening
- **Ask questions** - clarify before suggesting solutions
- **Think through** - trace the data flow, identify root causes
- **Run commands** - test your hypotheses
- **Be reluctant to build** - unless human explicitly requests implementation

## Commands

```bash
cd website
bun run dev              # Dev server (http://localhost:4321)
bun run build            # Production build
bunx astro check         # TypeScript checks
bunx prettier --write .  # Format
```

---

_Last updated: 2026-03-19_
