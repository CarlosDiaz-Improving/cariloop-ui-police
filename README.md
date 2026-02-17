# Cariloop UI Police

Visual regression testing tool for Cariloop frontend applications. Captures screenshots across multiple environments, compares them pixel-by-pixel, and generates interactive HTML diff reports.

> **Architecture & internals** — see [PROJECT.md](./PROJECT.md) for the full architecture reference, module breakdown, configuration guide, and data flow diagrams.

---

## Supported Apps

| App | Path | Auth |
|---|---|---|
| Cariloop Admin | `/admin` | Yes |
| Cariloop Auth | `/` | No |
| Cariloop Coach | `/coach` | Yes |
| Cariloop Employer | `/employer` | Yes |
| Cariloop Engagement | `/engagement` | Yes |
| Cariloop Enterprise | `/enterprise` | Yes |
| Cariloop Facilitator | `/facilitator` | Yes |
| Cariloop Plan | `/plan` | Yes |
| Cariloop Provider | `/provider` | Yes |
| Cariloop Search | `/search` | Yes |

Apps are configured in `ui-police.config.ts`. Adding a new one is just adding an entry to the `apps` array — see [PROJECT.md → Adding a New App](./PROJECT.md#adding-a-new-app).

## Requirements

- [Bun](https://bun.sh) v1.3.6+
- Playwright (auto-installed via `bun install`)

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Configure credentials
cp .env.example .env
# Edit .env with your Cariloop credentials

# 3. Run
bun run start
```

## Configuration

### Credentials (`.env`)

Only secrets live here. Pattern: `{ENV_NAME_UPPER}_EMAIL` / `_PASSWORD`

```dotenv
DEVELOP_EMAIL=dev.user@cariloop.com
DEVELOP_PASSWORD=dev-password

LOCAL_EMAIL=local.user@cariloop.com
LOCAL_PASSWORD=local-password
```

### Everything Else (`ui-police.config.ts`)

Environments, apps, viewports, timeouts, and capture options are all in the central config file:

```ts
environments: [
  { name: "develop", baseUrl: "https://dev-plan.cariloop.com" },
  { name: "local",   baseUrl: "https://local-plan.cariloop.com" },
],
capture: {
  viewport: { preset: "desktop-hd" },
  fullPage: true,
  headless: true,
},
```

See [PROJECT.md → Configuration System](./PROJECT.md#configuration-system) for all options.

## Usage

Two entry points — both coexist:

### CLI (Terminal)

```bash
bun run start
```

The interactive CLI will prompt you to:

1. **Select an app** to test
2. **Choose a run mode** — fresh, resume, retry failed, compare-only, or record
3. The pipeline runs automatically: **capture → compare → report**

### Web Dashboard

```bash
bun run ui
```

Opens a browser-based control panel at `http://localhost:3737` with:

- **Left panel** — app selector, action buttons (Pipeline, Capture, Compare, Report, Codegen), recorded scripts list, run history
- **Right panel** — real-time terminal log streamed via WebSocket

The dashboard can trigger all the same operations as the CLI. Set a custom port with `UI_POLICE_PORT=4000 bun run ui`.

### Playwright Codegen

```bash
bun run codegen              # interactive prompts
bun run codegen auth         # specify app
bun run codegen auth develop # specify app + env
```

Records a Playwright script and saves it to `output/captures/scripts/{app}/`. Registered scripts are **automatically executed** during the capture pipeline after page screenshots.

### Run Modes

| Mode | Description |
|---|---|
| **Fresh** | Delete previous progress and start a new capture run |
| **Resume** | Continue an interrupted run from where it left off |
| **Retry Failed** | Re-run only failed interactions |
| **Compare Only** | Skip capture, compare existing screenshots |
| **Record** | Open Playwright recorder for custom scripts |

## Output

All generated files live under a single `output/` directory. Incomplete runs are resumed automatically:

```
output/
  captures/
    auth/
      develop/
        260217-001/                ← Run ID: YYMMDD-NNN (per app+env)
          run-manifest.json
          login.png
          register.png
      local/
        260217-001/
          login.png
          register.png
      diffs/
        develop-vs-local/          ← Cross-env comparison
  reports/
    cariloop-auth/
      index.html                   ← Self-contained HTML diff report
    index.html                     ← Main dashboard
```

See [PROJECT.md → Output Directory](./PROJECT.md#output-directory) for the full convention.

## Features

- **Web dashboard** — browser-based control panel with real-time log streaming (Bun.serve + WebSocket)
- **CLI + UI** — both entry points coexist; use whichever you prefer
- **Playwright Codegen** — record scripts via `bun run codegen`, auto-executed during captures
- **Multi-environment** — capture all configured environments in a single session
- **Resume & retry** — interrupted runs can be resumed; failed interactions can be retried individually
- **Interaction capture** — menus, dialogs, hover states, form validation screenshots
- **Cross-env comparison** — diff develop vs local (latest completed runs)
- **Cross-run comparison** — diff today's run vs a previous run (historical regression)
- **HTML diff reports** — side-by-side with diff overlay, percentage badges, and navigation sidebar

## Development

```bash
# Type checking
bunx tsc --noEmit

# Run individual modules
bun run capture
bun run compare
bun run report

# Start the web dashboard
bun run ui

# Record a script
bun run codegen
```

## Project Structure

```
src/
  index.ts              # CLI entry point — app selection, run mode menu
  server.ts             # Web dashboard — Bun.serve() + WebSocket
  ui/
    dashboard.html      # Self-contained HTML dashboard (no framework)
  bin/
    codegen.ts          # Standalone Playwright Codegen CLI
  types/config.ts       # All TypeScript interfaces
  core/
    config.ts           # Runtime config (ui-police.config.ts + .env)
    capture.ts          # Screenshot pipeline
    compare.ts          # Pixel diff engine
    report.ts           # HTML report generator
    runs.ts             # Run ID generation & manifest I/O
    auth.ts             # Login flow
    discover.ts         # Page discovery
    interactions.ts     # UI interaction executor
    progress.ts         # Resume tracking
    logger.ts           # Interaction logging
    recorder.ts         # Playwright recorder + script execution
    log-stream.ts       # Console interceptor for WebSocket streaming
  utils/
    paths.ts            # Filename conventions
    terminal.ts         # Styled CLI output
    env.ts              # Environment variable reader
  apps/
    {name}/             # Per-app interaction definitions
```

For the full module-by-module breakdown, see [PROJECT.md → Core Modules](./PROJECT.md#core-modules).
