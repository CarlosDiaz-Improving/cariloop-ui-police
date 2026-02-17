# UI Police — Project Architecture

This document describes the internal architecture, directory conventions, configuration system, and module responsibilities of **Cariloop UI Police**.

For quick-start instructions see [README.md](./README.md).

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Directory Structure](#directory-structure)
  - [Source Code](#source-code)
  - [Captures Output](#captures-output)
- [Configuration System](#configuration-system)
  - [ui-police.config.ts](#ui-policeconfigts)
  - [.env (Secrets Only)](#env-secrets-only)
  - [Environments](#environments)
  - [Applications](#applications)
  - [Viewport & Capture Options](#viewport--capture-options)
  - [Timeouts](#timeouts)
- [Run System](#run-system)
  - [Run ID Format](#run-id-format)
  - [Run Lifecycle](#run-lifecycle)
  - [Manifests](#manifests)
- [Core Modules](#core-modules)
  - [index.ts — Entry Point](#indexts--entry-point)
  - [core/config.ts — Runtime Config](#coreconfigts--runtime-config)
  - [core/capture.ts — Screenshot Pipeline](#corecapturets--screenshot-pipeline)
  - [core/compare.ts — Pixel Diffing](#corecomparets--pixel-diffing)
  - [core/report.ts — HTML Report](#corereportts--html-report)
  - [core/runs.ts — Run Management](#corerunsts--run-management)
  - [core/auth.ts — Login Handler](#coreauthts--login-handler)
  - [core/discover.ts — Page Discovery](#corediscoverts--page-discovery)
  - [core/interactions.ts — UI Interactions](#coreinteractionsts--ui-interactions)
  - [core/progress.ts — Resume Tracking](#coreprogressts--resume-tracking)
  - [core/logger.ts — Interaction Logging](#coreloggerts--interaction-logging)
  - [core/recorder.ts — Playwright Recorder](#corerecorderts--playwright-recorder)
- [Utilities](#utilities)
  - [utils/paths.ts — Filename Conventions](#utilspathsts--filename-conventions)
  - [utils/terminal.ts — CLI Output](#utilsterminalts--cli-output)
  - [utils/env.ts — Environment Variables](#utilsenvts--environment-variables)
- [App Modules](#app-modules)
  - [Adding a New App](#adding-a-new-app)
  - [Adding Interactions](#adding-interactions)
- [Type System](#type-system)
- [Comparison Modes](#comparison-modes)
- [Data Flow](#data-flow)

---

## High-Level Overview

UI Police is a **visual regression testing tool** that:

1. **Captures** full-page screenshots of Cariloop apps across multiple environments (develop, local, staging, etc.)
2. **Compares** screenshots pixel-by-pixel between environments or across runs
3. **Generates** an interactive HTML report highlighting visual differences

It runs on **Bun** with **Playwright** for browser automation, **pngjs** for image parsing, and **pixelmatch** for pixel comparison.

---

## Directory Structure

### Source Code

```
cariloop-ui-police/
├── ui-police.config.ts        # Central config (environments, apps, viewports, timeouts)
├── .env                        # Secrets only (credentials)
├── package.json
├── run.sh                      # Shell wrapper for bun run
├── README.md                   # Quick-start guide
├── PROJECT.md                  # This file — architecture reference
├── CHANGELOG.md
├── output/                     # All generated output (gitignored)
│   ├── captures/              # Screenshots, manifests, logs
│   └── reports/               # HTML diff reports
│
└── src/
    ├── index.ts                # CLI entry point — app selection, run mode menu
    ├── server.ts               # Web dashboard — Bun.serve() HTTP + WebSocket server
    │
    ├── ui/
    │   └── dashboard.html      # Self-contained HTML dashboard (no framework)
    │
    ├── bin/
    │   └── codegen.ts          # Standalone Playwright Codegen CLI
    │
    ├── types/
    │   └── config.ts           # All TypeScript interfaces (ProjectConfig, RunManifest, etc.)
    │
    ├── core/
    │   ├── config.ts           # Runtime config loader — reads ui-police.config.ts + .env
    │   ├── auth.ts             # Playwright login flow (credentials from .env)
    │   ├── discover.ts         # Page discovery via link crawling
    │   ├── capture.ts          # Screenshot pipeline + codegen script execution
    │   ├── compare.ts          # Pixel diff engine — cross-env & cross-run modes
    │   ├── report.ts           # HTML report generator (self-contained, base64 images)
    │   ├── runs.ts             # Run ID generation, directory creation, manifest I/O
    │   ├── progress.ts         # Resume/retry tracking per environment
    │   ├── interactions.ts     # UI interaction executor (click, hover, fill)
    │   ├── logger.ts           # Interaction success/failure log
    │   ├── recorder.ts         # Playwright codegen recorder + script execution
    │   └── log-stream.ts       # Console interceptor for WebSocket log streaming
    │
    ├── utils/
    │   ├── paths.ts            # Filename helpers (page slug, parse/build filenames)
    │   ├── terminal.ts         # Styled CLI output (colors, banners, spinners)
    │   └── env.ts              # Environment variable reader with validation
    │
    └── apps/
        ├── index.ts            # Re-exports from config (app registry)
        ├── types.ts            # Re-exports from types/config.ts
        ├── admin/
        │   ├── index.ts        # Re-exports interactions
        │   └── interactions.ts # Admin-specific interactions (menus, dialogs)
        ├── auth/
        │   ├── index.ts
        │   ├── interactions.ts
        │   └── registration-flow.ts  # Special registration capture flow
        ├── coach/
        │   ├── index.ts
        │   └── interactions.ts
        ├── plan/
        │   ├── index.ts
        │   └── interactions.ts
        └── {other-apps}/       # employer, engagement, enterprise, etc.
            └── index.ts        # Minimal — no interactions yet
```

### Output Directory

All generated artifacts live under a single `output/` directory (gitignored):

```
output/
├── captures/
│   ├── manifest.json                      # Global index of all runs
│   │
│   └── {app}/                             # e.g., auth, admin, plan
│       ├── progress.json                  # Per-app resume tracking
│       ├── interaction-log.json           # Per-app interaction log
│       ├── failure-report.md              # Failure details (if any)
│       │
│       ├── {env}/                         # e.g., develop, local
│       │   └── {YYMMDD}-{NNN}/           # e.g., 260217-001 (run per app+env)
│       │       ├── run-manifest.json      # Detailed run metadata + screenshot inventory
│       │       ├── login.png              # Screenshot files — just the page slug
│       │       ├── register.png
│       │       └── admin-users__add-user-button.png   # Interaction: {slug}__{interaction-id}.png
│       │
│       └── diffs/                         # Comparison output (at app level)
│           ├── develop-vs-local/          # Cross-env comparison
│           └── develop-260217-002-vs-001/ # Cross-run comparison (historical)
│
└── reports/
    ├── index.html                         # Main dashboard
    └── cariloop-{app}/
        └── index.html                     # Per-app diff report
```

Key conventions:
- **Everything under `output/`** — single gitignored directory, no clutter in project root
- **Run ID format**: `YYMMDD-NNN` (date + daily sequence number, e.g., `260217-001`)
- **Runs are per app+env** — each environment has its own independent run sequence
- **Incomplete run protection** — if a previous run didn't finish, it is resumed instead of creating a duplicate
- **Screenshot filenames**: just the page slug (`login.png`, `admin-dashboard.png`) — no app or env in the filename
- **Interaction filenames**: `{page-slug}__{interaction-id}.png`
- **App, environment, and run** are encoded in the **directory path**, not the filename
- **Diffs** are stored at the app level under `{app}/diffs/{label}/`

---

## Configuration System

### ui-police.config.ts

The single source of truth for all **non-sensitive** settings. Located at the project root.

```ts
const config: ProjectConfig = {
  version: "2.0.0",

  environments: [
    { name: "develop", baseUrl: "https://dev-plan.cariloop.com" },
    { name: "local",   baseUrl: "https://local-plan.cariloop.com" },
  ],

  capture: {
    viewport: { preset: "desktop-hd" },   // or { width: 1920, height: 1080 }
    fullPage: true,
    format: "png",
    settleDelay: 2000,
    headless: true,
  },

  timeouts: {
    loginNavigation: 45000,
    loginRedirect:   45000,
    loginFormReady:  20000,
    pageNavigation:  30000,
    contentReady:    15000,
  },

  loginRetries: 1,
  useSameCredentials: false,

  apps: [
    {
      name: "admin",
      displayName: "Cariloop Admin",
      pathPrefix: "/admin",
      readySelector: 'a[href*="/admin"]',
      requiresAuth: true,
      fallbackPages: ["/admin/dashboard", "/admin/users", ...],
    },
    // ... more apps
  ],
};
```

### .env (Secrets Only)

Only credentials go here. The naming pattern is `{ENV_NAME_UPPER}_EMAIL` / `{ENV_NAME_UPPER}_PASSWORD`:

```dotenv
DEVELOP_EMAIL=dev.user@cariloop.com
DEVELOP_PASSWORD=dev-password

LOCAL_EMAIL=local.user@cariloop.com
LOCAL_PASSWORD=local-password
```

When `useSameCredentials: true`, only the first environment's credentials are used for all environments.

### Environments

Defined in `ui-police.config.ts` under `environments`. Order matters — the capture pipeline runs them sequentially and the default comparison pairs the first two.

Each environment needs:
- **name** — used for directory names, credential lookup, and display
- **baseUrl** — the root URL of the app in that environment

To add a new environment:
1. Add it to the `environments` array in `ui-police.config.ts`
2. Add matching credentials to `.env` (e.g., `STAGING_EMAIL`, `STAGING_PASSWORD`)

### Applications

Each app is defined in the `apps` array. Required fields:

| Field | Description |
|---|---|
| `name` | Internal identifier (e.g., `"admin"`) — used for directories and module loading |
| `displayName` | Shown in the CLI menu (e.g., `"Cariloop Admin"`) |
| `pathPrefix` | URL prefix for this app's routes (e.g., `"/admin"`, `""` for root) |
| `readySelector` | CSS selector to wait for after login, confirming the app has loaded |
| `requiresAuth` | Whether to run the login flow before capturing |
| `fallbackPages` | Default pages to capture if automatic page discovery fails |
| `options` | App-specific key-value options (e.g., `{ registrationMode: "screenshot-only" }`) |

### Viewport & Capture Options

Available viewport presets:

| Preset | Dimensions |
|---|---|
| `desktop-hd` | 1920 × 1080 |
| `desktop` | 1440 × 900 |
| `laptop` | 1366 × 768 |
| `tablet` | 1024 × 768 |
| `tablet-port` | 768 × 1024 |
| `mobile` | 375 × 812 |
| `mobile-small` | 320 × 568 |

Or use custom dimensions: `{ width: 1920, height: 1080 }`.

### Timeouts

All values in milliseconds:

| Timeout | Default | Purpose |
|---|---|---|
| `loginNavigation` | 45000 | Navigate to login page |
| `loginRedirect` | 45000 | Wait for post-login redirect |
| `loginFormReady` | 20000 | Wait for login form to appear |
| `pageNavigation` | 30000 | Navigate to a page |
| `contentReady` | 15000 | Wait for `readySelector` after navigation |
| `settleDelay` | 2000 | Additional delay before taking screenshot |

---

## Run System

### Run ID Format

Every capture session creates a **run** per environment. Runs are identified by:

```
YYMMDD-NNN
```

- **YYMMDD** — date (year, month, day)
- **NNN** — 3-digit daily sequence number (001, 002, ...)

Examples: `260217-001`, `260217-002`, `260218-001`

The sequence number resets each day and is **scoped per app + env**.

### Run Lifecycle

```
For each environment:
  getOrCreateRun()             → finds incomplete run OR creates a new one
    captureEnvironment()       → captures all pages
      ├── registerScreenshot() → adds each screenshot to the manifest
      └── completeRun()        → finalizes duration, status, updates global manifest
```

A single run covers **one app × one environment**. If a previous run for the same app+env is still incomplete (status `"running"`), it is **resumed** instead of creating a duplicate.

### Manifests

**Global manifest** (`output/captures/manifest.json`):
```json
{
  "totalRuns": 3,
  "runs": [
    {
      "runId": "260217-001",
      "app": "auth",
      "environment": "develop",
      "timestamp": "2026-02-17T08:30:00.000Z",
      "status": "completed"
    }
  ]
}
```

**Per-run manifest** (`output/captures/{app}/{env}/{runId}/run-manifest.json`):
```json
{
  "runId": "260217-001",
  "app": "auth",
  "environment": "develop",
  "baseUrl": "https://dev-plan.cariloop.com",
  "timestamp": "2026-02-17T08:30:00.000Z",
  "duration": "2m 15s",
  "trigger": "manual",
  "status": "completed",
  "version": "2.0.0",
  "pageCount": 12,
  "interactionCount": 5,
  "screenshots": [
    {
      "id": "scr-001",
      "page": "/login",
      "file": "login.png",
      "viewport": "1920x1080"
    }
  ]
}
```

---

## Core Modules

### index.ts — Entry Point

The CLI entry point. Responsibilities:
- Displays an interactive app selection menu
- Detects previous progress and offers resume/retry/fresh/compare-only modes
- Orchestrates the full pipeline: capture → compare → report
- Supports a Playwright recorder mode for recording custom scripts

### core/config.ts — Runtime Config

Loads `ui-police.config.ts` and merges it with `.env` credentials. Provides:
- `projectConfig` — raw config object
- `environments` — array of environment definitions
- `getCredentials(envName)` — fetches credentials from `.env`
- `APP_LIST`, `APPS`, `getAppConfig()` — app registry built from config + interaction modules
- `setCurrentApp()` / `getCurrentApp()` — global app state for the current session
- Viewport presets and timeout constants

### core/capture.ts — Screenshot Pipeline

The main capture engine. Flow:

1. `captureAll()` loops through all configured environments
2. For each environment, calls `captureEnvironment()`:
   - Calls `getOrCreateRun()` — resumes an incomplete run or creates a new one
   - Launches a Playwright browser
   - Logs in (if `requiresAuth`)
   - Discovers pages (or uses previously discovered pages)
   - Navigates to each page, takes a screenshot
   - Captures interaction states (menus, dialogs, hover states)
   - Registers each screenshot in the run manifest
   - Finalizes the run for that environment

3. After all environments are captured, runs any registered codegen scripts via `executeAllScripts()`

Key design: **one run = one app × one environment**. If a previous run for the same app+env didn't complete, it is resumed automatically.

### core/compare.ts — Pixel Diffing

Two comparison modes:

- **`compareCrossEnv(app, env1, env1RunId, env2, env2RunId)`** — Compare latest completed runs of two environments. Diffs go to `{app}/diffs/{env1}-vs-{env2}/`.
- **`compareCrossRun(app, env, currentRunId, previousRunId)`** — Compare the same environment across two different runs. Diffs go to `{app}/diffs/{env}-{current}-vs-{previous}/`.
- **`compareScreenshots(pages)`** — Convenience wrapper that finds the latest completed run per env and does cross-env diff.

Uses `pixelmatch` with a threshold of 0.1 and red diff highlighting.

### core/report.ts — HTML Report

Generates a self-contained HTML report with:
- Base64-embedded screenshots (no external file dependencies)
- Side-by-side comparison with diff overlay
- Diff percentage badges (green < 1%, yellow < 5%, red ≥ 5%)
- Collapsible interaction cards per page
- Navigation sidebar with jump-to links
- Summary statistics

### core/runs.ts — Run Management

Manages the `captures/` directory structure:
- **ID generation** — `nextRunId(app, env)` produces `YYMMDD-NNN` scoped per app+env
- **Incomplete run detection** — `findIncompleteRun(app, env)` finds non-completed runs
- **Smart creation** — `getOrCreateRun()` resumes incomplete or creates new
- **Manifest I/O** — read/write global and per-run manifests
- **Path helpers** — `getAppDir()`, `getEnvBaseDir()`, `getRunDir()`, `getDiffPairDir()` — all under `output/captures/`
- **Queries** — `listRuns()`, `getLatestCompletedRun()`, `getLatestRun()`, `getTotalRuns()`

### core/auth.ts — Login Handler

Handles Playwright login flow:
- Navigates to the login page
- Fills email/password from `.env` credentials
- Waits for post-login redirect
- Supports retry logic (`loginRetries` config)

### core/discover.ts — Page Discovery

Crawls the SPA to discover navigable pages:
- Finds all `<a>` elements matching the app's `pathPrefix`
- Deduplicates and normalizes URLs
- Falls back to `fallbackPages` if discovery fails

### core/interactions.ts — UI Interactions

Executes UI interactions (click menus, open dialogs, hover elements):
- `executeInteraction(page, interaction, pagePath)` — performs the action
- `closeInteraction(page, interaction)` — resets the UI state
- `shouldRunOnPage(interaction, pagePath)` — checks `pageFilter` regex
- `closeAllOverlays(page)` — dismisses any open overlays between interactions

### core/progress.ts — Resume Tracking

Tracks which pages/environments have been captured for resume capability:
- Persists a `progress.json` in `output/captures/{app}/`
- `isPageCaptured()` / `markPageCaptured()` — per-page tracking
- `isEnvironmentComplete()` / `markEnvironmentComplete()` — per-env tracking
- `isInteractionCaptured()` / `markInteractionCaptured()` — per-interaction tracking

### core/logger.ts — Interaction Logging

Logs interaction execution results:
- Success/failure/skipped status per interaction
- Duration tracking
- Failure report generation
- Summary statistics

### core/recorder.ts — Playwright Recorder + Script Execution

Integration with Playwright's code generation:
- `startRecording(app, env)` — launches Playwright codegen, captures generated code
- `saveRecordedScript(app, code, name)` — saves script to `output/captures/scripts/{app}/`
- `listScripts(app)` / `hasScripts(app)` — query the script registry
- `runScript(app, name)` — execute a saved script
- `executeAllScripts(app)` — run all registered scripts (called by capture pipeline)

### core/log-stream.ts — WebSocket Log Streaming

Intercepts `console.log` / `console.error` / `console.warn` and forwards output to connected WebSocket clients:
- `startIntercepting()` / `stopIntercepting()` — toggle console interception
- `broadcastLog(line)` — send a log line to all clients
- `broadcastStatus(status)` — send phase/progress updates
- `broadcastDone(result)` — send completion events
- `addClient(ws)` / `removeClient(ws)` — client connection management

### server.ts — Web Dashboard Server

`Bun.serve()` HTTP + WebSocket server providing a browser-based control panel:

**API routes:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/` | GET | Serves the dashboard HTML |
| `/api/config` | GET | Returns apps, environments, version |
| `/api/runs` | GET | List runs (filter by `?app=`) |
| `/api/scripts` | GET | List recorded scripts |
| `/api/status` | GET | Current running state |
| `/api/capture` | POST | Start capture for an app |
| `/api/compare` | POST | Run comparison |
| `/api/report` | POST | Generate report |
| `/api/pipeline` | POST | Full capture → compare → report |
| `/api/codegen` | POST | Start Playwright codegen |
| `/ws` | WS | Real-time log streaming |

Long-running operations (capture, pipeline) return immediately and stream progress via WebSocket.

### ui/dashboard.html — Browser Dashboard

Self-contained HTML file (inline CSS + JS, no framework):
- **Left panel** — app selector, action buttons, scripts list, run history
- **Right panel** — terminal-style log viewer with WebSocket connection
- Dark theme matching the report style (orange accents, monospace log)
- Auto-reconnect WebSocket, ANSI stripping, auto-scroll

### bin/codegen.ts — Playwright Codegen CLI

Standalone entry point for recording Playwright scripts:
- Accepts `[app] [env] [name]` as CLI arguments
- Falls back to interactive prompts if args missing
- Saves scripts to `output/captures/scripts/{app}/`
- Scripts are auto-executed during the capture pipeline

---

## Utilities

### utils/paths.ts — Filename Conventions

Screenshot filenames are **just the page slug**:

```
/login           → login.png
/admin/dashboard → admin-dashboard.png
/admin/users     → admin-users.png         (base page)
/admin/users     → admin-users__add-user-button.png  (interaction)
```

Functions:
- `pageSlug(pagePath)` — converts path to slug (`/admin/dashboard` → `admin-dashboard`)
- `pathToFilename(pagePath)` — slug + `.png`
- `interactionFilename(pagePath, interactionId)` — slug + `__` + interaction ID + `.png`
- `parseFilename(filename)` — reverse: extracts `pagePath` and optional `interactionId`

### utils/terminal.ts — CLI Output

Styled terminal output with colors, symbols, and formatting:
- `log.header()`, `log.step()`, `log.success()`, `log.error()`, `log.warning()`
- `log.page()`, `log.interaction()`, `log.fileSaved()`
- `style.*` — color functions (success, error, warning, muted, url, path, count)
- `symbols.*` — Unicode symbols (checkmark, cross, arrow, tee)
- `printBanner()`, `printMenu()`, `printComparisonSummary()`
- `formatDuration(ms)` — human-readable duration

### utils/env.ts — Environment Variables

- `requireEnv(name)` — reads an environment variable, throws if missing

---

## App Modules

Each app lives under `src/apps/{name}/` and may contain:

| File | Purpose |
|---|---|
| `index.ts` | Re-exports interactions (required) |
| `interactions.ts` | Defines UI interactions to capture (optional) |
| `registration-flow.ts` | Special flows like registration (app-specific) |

### Adding a New App

1. Add the app definition to the `apps` array in `ui-police.config.ts`:
   ```ts
   {
     name: "myapp",
     displayName: "Cariloop MyApp",
     pathPrefix: "/myapp",
     readySelector: 'a[href*="/myapp"]',
     requiresAuth: true,
     fallbackPages: ["/myapp/dashboard"],
   }
   ```

2. Create the app directory:
   ```
   src/apps/myapp/
     index.ts              # export { interactionGroups, getAllInteractions } from "./interactions";
   ```

3. (Optional) Add `interactions.ts` with interaction definitions.

That's it — the config system auto-discovers the app and adds it to the CLI menu.

### Adding Interactions

Interactions are grouped by type and defined in `src/apps/{name}/interactions.ts`:

```ts
import type { Interaction, InteractionGroup } from "../types";

const menuInteractions: Interaction[] = [
  {
    id: "user-menu",
    description: "Open user dropdown menu",
    selector: '[data-testid="user-menu"]',
    action: "click",
    waitForSelector: ".menu-dropdown",
    closeAfter: "escape",
    pageFilter: /\/admin/,
  },
];

export const interactionGroups: InteractionGroup[] = [
  { name: "Menus", description: "Menu interactions", interactions: menuInteractions },
];

export function getAllInteractions(): Interaction[] {
  return interactionGroups.flatMap((g) => g.interactions);
}
```

Interaction fields:

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID — used in screenshot filename |
| `description` | Yes | Human-readable label |
| `selector` | Yes | CSS selector for the target element |
| `action` | Yes | `"click"`, `"hover"`, or `"fill"` |
| `waitForSelector` | No | Wait for this element to appear after action |
| `settleDelay` | No | Additional delay after action (ms) |
| `pageFilter` | No | Only run on pages matching this regex |
| `closeAfter` | No | How to reset: `"click"`, `"escape"`, or `"none"` |
| `fillData` | No | For `fill` actions: `[{ selector, value }]` |
| `clickAfterFill` | No | Submit button selector after filling |

---

## Type System

All types are defined in `src/types/config.ts`:

| Interface | Purpose |
|---|---|
| `ProjectConfig` | Shape of `ui-police.config.ts` |
| `EnvironmentDefinition` | Environment name + base URL |
| `AppDefinition` | App config entry (static) |
| `AppConfig` | Runtime app config (static + loaded interactions) |
| `CaptureOptions` | Viewport, full-page, format, delays |
| `TimeoutConfig` | All timeout values |
| `GlobalManifest` | Index of all runs (`captures/manifest.json`) |
| `RunSummary` | Lightweight run entry in global manifest (one app × one env) |
| `RunManifest` | Detailed per-run manifest (one app × one env) |
| `ScreenshotEntry` | Individual screenshot record |
| `Interaction` | UI interaction definition |
| `InteractionGroup` | Group of related interactions |
| `CustomScript` | Recorder script metadata |

---

## Comparison Modes

| Mode | Function | When to Use |
|---|---|---|
| **Cross-env** | `compareCrossEnv(app, env1, run1, env2, run2)` | Compare develop vs local (latest completed runs) |
| **Cross-run** | `compareCrossRun(app, env, currentRunId, prevRunId)` | Compare today's develop vs yesterday's develop |
| **Default** | `compareScreenshots(pages)` | Quick compare — latest completed per env, cross-env |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     src/index.ts                        │
│  1. Select app   2. Choose run mode   3. Orchestrate    │
└──────────┬──────────────────┬──────────────┬────────────┘
           │                  │              │
           ▼                  ▼              ▼
    ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
    │  capture.ts   │  │  compare.ts  │  │  report.ts   │
    │               │  │              │  │              │
    │ getOrCreate() │  │ compareDirs()│  │ generateHTML()│
    │ captureEnv()  │  │ pixelmatch() │  │ base64 embed │
    │ registerScr() │  │ writeDiffs() │  │ writeReport()│
    └──────┬────────┘  └──────┬───────┘  └──────────────┘
           │                  │
           ▼                  ▼
    ┌──────────────────────────────────────────┐
    │  output/                                 │
    │    captures/{app}/{env}/{runId}/         │
    │      run-manifest.json                   │
    │      login.png  register.png  ...        │
    │    captures/{app}/diffs/ ...             │
    │    reports/cariloop-{app}/index.html     │
    └──────────────────────────────────────────┘
```
