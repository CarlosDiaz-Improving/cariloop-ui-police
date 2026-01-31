# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

Visual regression testing tool for Cariloop frontend applications. Supports multiple apps (admin, plan, coach, auth). Captures screenshots from two environments (dev-plan and local-plan), compares them pixel-by-pixel, and generates an HTML report highlighting visual differences.

**Multi-App Support** - Select which Cariloop app to test at startup:
- **Cariloop Admin** (`/admin`) - Admin dashboard
- **Cariloop Plan** (`/plan`) - Member-facing plan
- **Cariloop Coach** (`/coach`) - Care coach dashboard
- **Cariloop Auth** (`/`) - Login/auth screens

**Interaction Capture** - Beyond static page screenshots, the tool captures UI states after interactions:
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

**Folder Structure:**

```
src/
  index.ts              # Main entry point, orchestrator
  apps/                 # App-specific configurations
    admin/
      index.ts          # Admin app config
      interactions.ts   # Admin-specific interactions
    plan/
    coach/
    auth/
    types.ts            # Shared types (Interaction, AppConfig)
    index.ts            # App registry
  core/                 # Shared core modules
    config.ts           # Global config, viewport, credentials
    auth.ts             # Login/logout logic
    discover.ts         # Page discovery
    capture.ts          # Screenshot capture
    compare.ts          # Pixel comparison
    report.ts           # HTML report generation
    progress.ts         # Progress tracking
    interactions.ts     # Interaction execution
    logger.ts           # Interaction logging
    index.ts            # Barrel export
  utils/                # Utility functions
    terminal.ts         # Colors, styled logging
    env.ts              # Environment variable helpers
    paths.ts            # Filename utilities
    index.ts            # Barrel export
```

**Pipeline:** `index.ts` orchestrates three sequential steps:

```
index.ts (app selection → capture → compare → report)
  → core/config.ts (multi-app config, viewport presets, credentials)
  → core/capture.ts (Playwright browser automation)
      → core/auth.ts (login/logout with retry)
      → core/discover.ts (scan DOM for nav links)
      → apps/<app>/interactions.ts (app-specific UI interactions)
      → core/progress.ts (persist state)
  → core/compare.ts (pixelmatch pixel-level diff)
  → core/report.ts (self-contained HTML with base64-embedded images)
```

**Key design decisions:**
- **App-specific modules**: Each app has its own folder in `src/apps/` with interactions and config specific to that app.
- **Shared core**: Common functionality lives in `src/core/` and is app-agnostic.
- **Styled terminal output**: `utils/terminal.ts` provides consistent colored logging.
- **SPA navigation**: Uses `waitUntil: "domcontentloaded"` (not `networkidle`) because Cariloop SPAs have persistent connections.
- **Configurable viewport**: Preset resolutions or custom dimensions via env vars.
- **Progress manifest**: Saves after every captured page/interaction so interrupted runs can resume.

## Adding New Interactions

Edit `src/apps/<app>/interactions.ts` to add app-specific UI elements to capture:

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

All settings live in `src/core/config.ts`:
- `APPS` record: Defines pathPrefix, readySelector, fallbackPages for each app
- `environments`: URLs for dev and local environments
- `getCredentials(envName)`: Returns credentials, supporting separate local env credentials
- `VIEWPORT_PRESETS`: desktop-hd (1920x1080), desktop (1440x900), laptop (1366x768), tablet (1024x768), mobile (375x812)
- `getViewport()`: Returns viewport from env vars (VIEWPORT_PRESET or VIEWPORT_WIDTH/HEIGHT)
- `timeouts`: Configurable via .env

**Viewport Configuration:**
```bash
# Use a preset
VIEWPORT_PRESET=laptop

# Or custom dimensions
VIEWPORT_WIDTH=1280
VIEWPORT_HEIGHT=720
```

## Generated Directories

Organized by app under `screenshots/` and `reports/`:

```
screenshots/
  cariloop-admin/
    dev/       # captured PNGs
    local/     # captured PNGs
    diff/      # diff overlay PNGs
    progress.json
    interaction-log.json
  cariloop-plan/
    ...
reports/
  cariloop-admin/
    index.html
  cariloop-plan/
    index.html
```
