# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

Visual regression testing tool for Cariloop's admin UI. Captures screenshots from two environments (dev-plan and local-plan), compares them pixel-by-pixel, and generates an HTML report highlighting visual differences.

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
      → progress.ts (persist state to screenshots/progress.json)
  → compare.ts (pixelmatch pixel-level diff)
  → report.ts (self-contained HTML with base64-embedded images)
```

**Key design decisions:**
- **SPA navigation**: Uses `waitUntil: "domcontentloaded"` (not `networkidle`) because the Cariloop SPA has persistent connections that prevent network idle. Content readiness is handled by `page.waitForSelector('a[href*="/admin"]')` for sidebar rendering.
- **Progress manifest** (`screenshots/progress.json`): Saves after every captured page so interrupted runs can resume. `isPageCaptured()` checks both the manifest AND that the .png file exists on disk.
- **Page discovery**: First environment discovers admin pages from sidebar links; subsequent environments reuse the same page list from the manifest rather than re-discovering.
- **Resilience**: Login has configurable retries. Per-environment failures are caught and logged without aborting the whole run. Individual page capture failures are caught and skipped.
- **Interactive menu on start**: Detects prior progress and offers Resume/Restart/Compare-only modes.

## Configuration

All settings live in `src/config.ts`: environment URLs, credentials, viewport (1920x1080), timeouts, retry counts, and fallback admin pages. No environment variables needed.

## Generated Directories

- `screenshots/dev/`, `screenshots/local/` — captured PNGs
- `screenshots/diff/` — diff overlay PNGs
- `screenshots/progress.json` — resumable state
- `reports/index.html` — final visual report
