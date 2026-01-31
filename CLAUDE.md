# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

Visual regression testing tool for Cariloop's admin UI. Captures screenshots from two environments (dev-plan and local-plan), compares them pixel-by-pixel, and generates an HTML report highlighting visual differences.

**NEW: Interaction Capture** - Beyond static page screenshots, the tool now captures UI states after interactions:
- Clicking dropdown menus (3-dot action menus)
- Opening modals via ADD/IMPORT buttons
- Expanding sidebar sections (e.g., SERVICES)
- Hovering over elements to reveal tooltips
- Switching tabs

## Commands

```bash
bun install                      # Install dependencies
bun run start                    # Full pipeline: capture + compare + report (interactive menu)
bun run capture                  # Standalone: capture screenshots only
bun run compare                  # Standalone: compare existing screenshots
bun run report                   # Standalone: generate report from existing comparisons
bunx tsc --noEmit --skipLibCheck # Type check
```

No test suite exists yet. Use `bun test` with `import { test, expect } from "bun:test"` when adding tests.

## Bun Runtime

Default to Bun instead of Node.js for everything:
- `bun <file>` not `node`/`ts-node`, `bun install` not `npm install`, `bunx` not `npx`
- Bun auto-loads `.env` — no dotenv needed
- Prefer `Bun.file()` over `node:fs` readFile/writeFile
- Use `bun:test` for testing, not jest/vitest

## Architecture

Pipeline runs in three sequential steps, orchestrated by `src/index.ts`:

```
index.ts (orchestrator + interactive menu)
  → capture.ts (Playwright browser automation)
      → auth.ts (login with retry)
      → discover.ts (scan DOM for admin nav links)
      → interactions.ts (define & execute UI interactions)
      → progress.ts (persist state to screenshots/progress.json)
  → compare.ts (pixelmatch pixel-level diff)
  → report.ts (self-contained HTML with base64-embedded images)
```

**Key design decisions:**
- **SPA navigation**: Uses `waitUntil: "domcontentloaded"` (not `networkidle`) because the Cariloop SPA has persistent connections that prevent network idle. Content readiness is handled by `page.waitForSelector('a[href*="/admin"]')` for sidebar rendering.
- **Progress manifest** (`screenshots/progress.json`): Saves after every captured page/interaction so interrupted runs can resume. Tracks both `capturedPages` and `capturedInteractions` per environment.
- **Page discovery**: First environment discovers admin pages from sidebar links; subsequent environments reuse the same page list from the manifest rather than re-discovering.
- **Interaction system** (`interactions.ts`): Defines configurable interactions (click, hover) with CSS selectors. Each interaction specifies what element to interact with, what to wait for after, and how to reset the UI state.
- **Resilience**: Login has configurable retries. Per-environment failures are caught and logged without aborting the whole run. Individual page/interaction capture failures are caught and skipped.
- **Interactive menu on start**: Detects prior progress and offers Resume/Restart/Compare-only modes.

## Adding New Interactions

Edit `src/interactions.ts` to add new UI elements to capture:

```typescript
{
  id: "unique-id",           // Used in screenshot filename
  description: "What this captures",
  selector: "css-selector",  // Can be comma-separated for multiple fallbacks
  action: "click" | "hover",
  waitForSelector: "what-appears-after",  // Optional
  settleDelay: 300,          // Optional, ms to wait
  pageFilter: /regex/,       // Optional, only run on matching pages
  closeAfter: "escape" | "click" | "none"  // How to reset UI
}
```

## Configuration

All settings live in `src/config.ts`: environment URLs, credentials, viewport (1920x1080), timeouts, retry counts, and fallback admin pages. No environment variables needed.

## Generated Directories

- `screenshots/dev/`, `screenshots/local/` — captured PNGs (pages + interactions)
- `screenshots/diff/` — diff overlay PNGs
- `screenshots/progress.json` — resumable state (pages + interactions)
- `reports/index.html` — final visual report (grouped by page with nested interactions)
