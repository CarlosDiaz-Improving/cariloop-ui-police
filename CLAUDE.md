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

Pipeline runs in three sequential steps, orchestrated by `src/index.ts`:

```
index.ts (orchestrator + app selection + interactive menu)
  → config.ts (multi-app configuration: APPS, getScreenshotsDir, setCurrentApp)
  → capture.ts (Playwright browser automation)
      → auth.ts (login/logout with retry, env-specific credentials)
      → discover.ts (scan DOM for app-specific nav links)
      → interactions.ts (define & execute UI interactions)
      → progress.ts (persist state to <app>-screenshots/progress.json)
  → compare.ts (pixelmatch pixel-level diff)
  → report.ts (self-contained HTML with base64-embedded images)
```

**Key design decisions:**
- **Multi-app architecture**: `config.ts` defines `APPS` record with each app's pathPrefix, readySelector, and fallbackPages. `setCurrentApp()` switches context; `getScreenshotsDir()` and `getReportsDir()` return app-specific paths.
- **SPA navigation**: Uses `waitUntil: "domcontentloaded"` (not `networkidle`) because Cariloop SPAs have persistent connections. Content readiness uses app-specific `readySelector`.
- **Progress manifest** (`<app>-screenshots/progress.json`): Saves after every captured page/interaction so interrupted runs can resume. Tracks both `capturedPages` and `capturedInteractions` per environment.
- **Page discovery**: First environment discovers pages from navigation links; subsequent environments reuse the same page list from the manifest.
- **Interaction system** (`interactions.ts`): Defines configurable interactions (click, hover) with CSS selectors and page filters.
- **Credential handling**: Supports optional separate credentials for local environment via `LOCAL_CARILOOP_EMAIL`/`LOCAL_CARILOOP_PASSWORD`.
- **Resilience**: Login has configurable retries. Per-environment failures are caught and logged without aborting the whole run.

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

All settings live in `src/config.ts`:
- `APPS` record: Defines pathPrefix, readySelector, fallbackPages for each app
- `environments`: URLs for dev and local environments
- `getCredentials(envName)`: Returns credentials, supporting separate local env credentials
- `viewport`: 1920x1080
- `timeouts`: Configurable via .env

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
