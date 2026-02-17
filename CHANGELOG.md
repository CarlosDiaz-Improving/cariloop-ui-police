# Changelog

All notable changes to UI Police will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

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
