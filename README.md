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

```bash
bun run start
```

The interactive CLI will prompt you to:

1. **Select an app** to test
2. **Choose a run mode** — fresh, resume, retry failed, or compare-only
3. The pipeline runs automatically: **capture → compare → report**

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

- **Multi-environment** — capture all configured environments in a single run
- **Resume & retry** — interrupted runs can be resumed; failed interactions can be retried individually
- **Interaction capture** — menus, dialogs, hover states, form validation screenshots
- **Cross-env comparison** — diff develop vs local within the same run
- **Cross-run comparison** — diff today's run vs a previous run (historical regression)
- **HTML diff reports** — side-by-side with diff overlay, percentage badges, and navigation sidebar
- **Playwright recorder** — record custom interaction scripts for replay

## Development

```bash
# Type checking
bunx tsc --noEmit

# Run individual modules
bun run src/core/capture.ts
bun run src/core/compare.ts
bun run src/core/report.ts
```

## Project Structure

```
src/
  index.ts              # CLI entry point — app selection, run mode menu
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
    recorder.ts         # Playwright recorder
  utils/
    paths.ts            # Filename conventions
    terminal.ts         # Styled CLI output
    env.ts              # Environment variable reader
  apps/
    {name}/             # Per-app interaction definitions
```

For the full module-by-module breakdown, see [PROJECT.md → Core Modules](./PROJECT.md#core-modules).
