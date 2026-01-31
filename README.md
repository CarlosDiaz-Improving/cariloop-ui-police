# Cariloop UI Police

Visual regression testing tool for Cariloop frontend applications. Compares screenshots between `dev` and `local` environments to detect UI differences.

## Supported Apps

- **Cariloop Admin** (`/admin`) - Admin dashboard
- **Cariloop Plan** (`/plan`) - Member-facing plan portal
- **Cariloop Coach** (`/coach`) - Care coach dashboard  
- **Cariloop Auth** (`/`) - Login and authentication screens

## Requirements

- [Bun](https://bun.sh) v1.3.6+
- Playwright (auto-installed)

## Installation

```bash
bun install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:

```dotenv
DEV_PLAN_URL=https://dev-plan.cariloop.com
LOCAL_PLAN_URL=https://local-plan.cariloop.com

CARILOOP_EMAIL=your.email@cariloop.com
CARILOOP_PASSWORD=your-password

# Optional: Separate credentials for local environment
# LOCAL_CARILOOP_EMAIL=local.email@cariloop.com
# LOCAL_CARILOOP_PASSWORD=local-password
```

## Usage

```bash
bun run start
```

On startup, you'll be prompted to select which app to test:

```
📱 Select application to test:

  [1] Cariloop Admin
  [2] Cariloop Plan
  [3] Cariloop Coach
  [4] Cariloop Auth

Your choice [1]:
```

The tool will then:

1. **Capture screenshots** from both environments
2. **Capture interaction states** (menus, dialogs, hover states)
3. **Compare screenshots** pixel-by-pixel
4. **Generate an HTML report** with diff visualizations

## Output

Screenshots and reports are organized by app:

```
screenshots/
  cariloop-admin/
    dev/
    local/
    diff/
  cariloop-plan/
    dev/
    local/
    diff/
  ...
reports/
  cariloop-admin/
    index.html
  cariloop-plan/
    index.html
  ...
```

## Features

### Resume Capability

If interrupted, the tool can resume from where it left off.

### Interaction Capture

Automatically captures UI states after interactions:
- Material menu popups (3-dot menus)
- Dialog modals (add/edit forms)
- Expandable sidebar sections
- Hover states

### Retry Failed Interactions

Failed interactions can be retried without recapturing all pages.

## Development

Type checking:

```bash
bunx tsc --noEmit
```

Run individual modules:

```bash
bun run src/capture.ts
bun run src/compare.ts
bun run src/report.ts
```

## Project Structure

```
src/
  index.ts       # Main entry point with app selection
  config.ts      # Multi-app configuration
  auth.ts        # Login/logout handling
  discover.ts    # Page discovery from navigation
  capture.ts     # Screenshot capture logic
  interactions.ts # UI interaction definitions
  compare.ts     # Pixel comparison
  report.ts      # HTML report generation
  progress.ts    # Progress tracking
  logger.ts      # Interaction logging
```
