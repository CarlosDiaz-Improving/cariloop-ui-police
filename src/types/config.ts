/**
 * Central type definitions for the UI Police configuration system.
 * These types define the shape of ui-police.config.ts and the run/manifest system.
 */

// ============================================
// PROJECT CONFIGURATION (ui-police.config.ts)
// ============================================

/**
 * Top-level project configuration
 */
export interface ProjectConfig {
  /** Semantic version of the UI Police system */
  version: string;

  /** Environments to test against */
  environments: EnvironmentDefinition[];

  /** Screenshot capture options */
  capture: CaptureOptions;

  /** Timeout settings (ms) */
  timeouts: TimeoutConfig;

  /** Number of login retry attempts */
  loginRetries: number;

  /** When true, uses the first environment's credentials for all environments */
  useSameCredentials: boolean;

  /** Applications available for testing */
  apps: AppDefinition[];
}

/**
 * Environment definition (e.g., develop, local, staging)
 */
export interface EnvironmentDefinition {
  /** Internal name used in filenames and directories */
  name: string;
  /** Base URL for this environment */
  baseUrl: string;
}

/**
 * Screenshot capture options
 */
export interface CaptureOptions {
  /** Viewport configuration — use a preset name or custom dimensions */
  viewport: ViewportPreset | ViewportCustom;
  /** Capture full scrollable page (default: true) */
  fullPage: boolean;
  /** Image format (default: "png") */
  format: "png" | "jpeg";
  /** Delay in ms after navigation before capturing (default: 2000) */
  settleDelay: number;
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
}

export interface ViewportPreset {
  preset: string;
}

export interface ViewportCustom {
  width: number;
  height: number;
}

/**
 * Timeout configuration (all values in milliseconds)
 */
export interface TimeoutConfig {
  loginNavigation: number;
  loginRedirect: number;
  loginFormReady: number;
  pageNavigation: number;
  contentReady: number;
}

/**
 * Application definition in the central config
 */
export interface AppDefinition {
  /** Internal name (e.g., "admin", "plan", "auth") */
  name: string;
  /** Display name shown in UI (e.g., "Cariloop Admin") */
  displayName: string;
  /** URL path prefix (e.g., "/admin", "/plan", "" for root) */
  pathPrefix: string;
  /** CSS selector to wait for after login to confirm the app is ready */
  readySelector: string;
  /** Whether authentication is required before capturing */
  requiresAuth: boolean;
  /** Default pages to capture if link discovery fails or as a baseline */
  fallbackPages: string[];
  /** App-specific options (e.g., { registrationMode: "screenshot-only" }) */
  options?: Record<string, unknown>;
}

// ============================================
// GLOBAL MANIFEST (captures/manifest.json)
// ============================================

/**
 * Global manifest — index of all capture runs
 */
export interface GlobalManifest {
  /** Total number of runs in the manifest */
  totalRuns: number;
  /** Array of run summaries */
  runs: RunSummary[];
}

/**
 * Summary entry for a single run in the global manifest.
 * Each run is scoped to ONE app + ONE environment.
 */
export interface RunSummary {
  /** Unique run identifier (e.g., "260217-001") */
  runId: string;
  /** Application name */
  app: string;
  /** Environment name */
  environment: string;
  /** ISO 8601 timestamp when the run started */
  timestamp: string;
  /** Run status */
  status: "running" | "completed" | "failed" | "cancelled";
}

// ============================================
// PER-RUN MANIFEST (captures/{app}/{env}/{YYMMDD-NNN}/run-manifest.json)
// ============================================

/**
 * Detailed manifest for a single capture run.
 * A run captures ONE app × ONE environment.
 */
export interface RunManifest {
  /** Unique run identifier (e.g., "260217-001") */
  runId: string;
  /** Application name */
  app: string;
  /** Environment name (e.g., "develop", "local") */
  environment: string;
  /** Base URL used for this environment */
  baseUrl: string;
  /** ISO 8601 timestamp when the run started */
  timestamp: string;
  /** Human-readable duration (e.g., "1m 45s") */
  duration: string;
  /** How the run was triggered */
  trigger: "manual" | "script" | "scheduled";
  /** Run status */
  status: "running" | "completed" | "failed" | "cancelled";
  /** UI Police version used for this run */
  version: string;
  /** Number of pages captured */
  pageCount: number;
  /** Number of interactions captured */
  interactionCount: number;
  /** Detailed screenshot inventory */
  screenshots: ScreenshotEntry[];
}

/**
 * Individual screenshot entry in a run manifest.
 * Filename is just the page slug (e.g., "login.png") —
 * app, env, and run are encoded in the directory path.
 */
export interface ScreenshotEntry {
  /** Unique screenshot identifier within this run (e.g., "scr-001") */
  id: string;
  /** Page path that was captured (e.g., "/login") */
  page: string;
  /** Filename within the run directory (e.g., "login.png") */
  file: string;
  /** Viewport dimensions used (e.g., "1920x1080") */
  viewport: string;
  /** If this is an interaction screenshot, the interaction ID */
  interactionId?: string;
  /** Human-readable description for interactions */
  description?: string;
}

// ============================================
// RUNTIME APP CONFIG (built from AppDefinition + interactions)
// ============================================

/**
 * Interaction to perform on a page and capture the resulting UI state
 */
export interface Interaction {
  /** Unique identifier for this interaction (used in screenshot filenames) */
  id: string;
  /** Human-readable description */
  description: string;
  /** CSS selector for the element to interact with */
  selector: string;
  /** Type of interaction */
  action: "click" | "hover" | "fill";
  /** Data for fill actions: array of {selector, value} pairs to fill before screenshot */
  fillData?: Array<{ selector: string; value: string }>;
  /** Optional: Wait for this selector to appear after the interaction */
  waitForSelector?: string;
  /** Optional: Additional delay after interaction (ms) */
  settleDelay?: number;
  /** Optional: Only run on pages matching this regex */
  pageFilter?: RegExp;
  /** Optional: Close/reset after capture (click same element or press Escape) */
  closeAfter?: "click" | "escape" | "none";
  /** Optional: click a submit button after filling (for validation-error captures) */
  clickAfterFill?: string;
}

/**
 * Group of related interactions
 */
export interface InteractionGroup {
  name: string;
  description: string;
  interactions: Interaction[];
}

/**
 * Full runtime app configuration — combines config definition with loaded interactions
 */
export interface AppConfig {
  /** Internal name */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** URL path prefix */
  pathPrefix: string;
  /** Selector to wait for after login to confirm app is ready */
  readySelector: string;
  /** Whether authentication is required */
  requiresAuth: boolean;
  /** Default pages to capture */
  fallbackPages: string[];
  /** App-specific options */
  options: Record<string, unknown>;
  /** Interaction groups for this app */
  interactionGroups: InteractionGroup[];
  /** Function to get all interactions flattened */
  getAllInteractions: () => Interaction[];
}

// ============================================
// CUSTOM SCRIPTS (Playwright recorder)
// ============================================

/**
 * Registered custom script for an app
 */
export interface CustomScript {
  /** Script name identifier */
  name: string;
  /** Relative file path to the script */
  file: string;
  /** Human-readable description */
  description: string;
  /** When the script was recorded */
  createdAt: string;
}
