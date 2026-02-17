# Changelog

All notable changes to UI Police will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-02-17

### Added

- **Web Dashboard** (`bun run ui`) — browser-based control panel at `http://localhost:3737` using `Bun.serve()` + WebSocket. Left panel with app selector, action buttons, scripts list, and run history. Right panel with real-time terminal log streaming.
- **Playwright Codegen CLI** (`bun run codegen`) — standalone entry point for recording Playwright scripts. Accepts `[app] [env] [name]` args or prompts interactively. Scripts saved to `output/captures/scripts/{app}/`.
- **Codegen script auto-execution** — registered scripts are automatically executed during the capture pipeline after all page screenshots are taken.
- **`src/server.ts`** — Bun.serve() HTTP + WebSocket server with REST API for capture, compare, report, codegen, and pipeline operations.
- **`src/ui/dashboard.html`** — self-contained HTML dashboard (no framework, inline CSS + JS, dark theme with orange accents).
- **`src/bin/codegen.ts`** — standalone Playwright Codegen CLI with interactive prompts and `--help`.
- **`src/core/log-stream.ts`** — console interceptor that fans out `console.log`/`error`/`warn` to WebSocket clients while preserving terminal output.
- **`bin` entries in `package.json`** — `ui-police`, `ui-police-ui`, `ui-police-codegen` for direct execution.
- **`recorder.ts` enhancements** — `executeAllScripts()`, `hasScripts()` for pipeline integration.

### Changed

- **Output centralized under `output/`** — captures at `output/captures/`, reports at `output/reports/`. No more `screenshots/`, `captures/`, or `reports/` at project root.
- **Per-environment runs** — directory structure changed to `output/captures/{app}/{env}/{YYMMDD-NNN}/`. Each run is scoped to one app × one environment. Run IDs are sequential per app+env+date.
- **Incomplete run protection** — `getOrCreateRun()` detects and resumes incomplete runs instead of creating duplicates.
- **`RunManifest` flattened** — single environment per manifest (no more nested `RunEnvironmentData`). `RunSummary.environment` is now a singular string.
- **`captureAll()` returns `runIds: Record<string, string>`** (env→runId map) instead of a single `runId`.
- **`compareScreenshots()` uses `getLatestCompletedRun()` per environment** for cross-env diffs.
- **`.gitignore` simplified** — single `output/` entry replaces `screenshots/`, `captures/`, `reports/`.
- **Version bumped to 2.0.0**.

### Removed

- **`getScreenshotsDir()`** — replaced by `getAppDir()` from `runs.ts` and `getOutputDir()` from `config.ts`.
- **`completeRunEnvironment()`** — no longer needed since each run is single-environment.
- **`RunEnvironmentData` interface** — flattened into `RunManifest`.
- **Legacy `screenshots/` directory** — all output now under `output/`.

---

## [1.0.0] - 2026-02-17

### Added

- **Central configuration file** (`ui-police.config.ts`) — all non-sensitive settings (environments, viewports, timeouts, capture options, app definitions) live here instead of `.env`.
- **Run serialization system** — each capture creates a unique run (`run-0001`, `run-0002`, etc.) under `captures/runs/`. A global manifest (`captures/manifest.json`) indexes all runs; each run has its own `run-manifest.json` with detailed metadata and screenshot inventory.
- **New screenshot naming convention** — filenames now include app and environment: `cariloop-{app}-{env}-{page-slug}.png` (e.g., `cariloop-admin-develop-admin-dashboard.png`).
- **Dynamic app registry** — apps are defined in the central config and loaded dynamically. Interaction modules are auto-discovered from `src/apps/{name}/interactions.ts`.
- **6 new application stubs** — employer, engagement, enterprise, facilitator, provider, search (with empty interaction modules ready to be populated).
- **Playwright recorder mode** — new CLI menu option to open a headed browser, interact with the UI manually, and save the generated Playwright script for later reuse.
- **Run-based comparison** — the comparison system now pairs screenshots from two runs (one per environment) instead of comparing directory trees. Supports cross-run historical comparison.
- **Dynamic environment labels in reports** — report HTML uses actual environment names from config instead of hardcoded "Develop"/"Local".
- **Capture options in config** — viewport, fullPage, format, settleDelay, and headless mode are configurable in `ui-police.config.ts`.
- **Version display** — CLI shows the project version from config on startup.

### Changed

- **`.env` is now secrets-only** — credential pattern changed to `{ENVIRONMENT_NAME_UPPER}_EMAIL` / `{ENVIRONMENT_NAME_UPPER}_PASSWORD` (e.g., `DEVELOP_EMAIL`, `LOCAL_PASSWORD`). All non-sensitive settings moved to the central config.
- **`AppConfig.skipLogin` replaced by `requiresAuth`** — inverted boolean for clarity. Apps that don't require authentication set `requiresAuth: false`.
- **`pathToFilename()` and `interactionFilename()`** now require `appName` and `envName` parameters for the new naming convention.
- **`ComparisonResult`** fields renamed: `devScreenshot`/`localScreenshot` → `env1Screenshot`/`env2Screenshot`, with `env1Name`/`env2Name` and `run1Id`/`run2Id` added.
- **`captureAll()` return type** now includes `runIds: string[]` for traceability.

### Removed

- **Per-app `index.ts` config files** (`src/apps/admin/index.ts`, etc.) — app configuration data moved to `ui-police.config.ts`. Interaction modules remain in `src/apps/{name}/interactions.ts`.
- **Environment URL env vars** (`DEV_PLAN_URL`, `LOCAL_PLAN_URL`) — URLs now defined in central config.
- **Timeout/viewport env vars** (`LOGIN_NAV_TIMEOUT`, `VIEWPORT_PRESET`, etc.) — moved to central config.
