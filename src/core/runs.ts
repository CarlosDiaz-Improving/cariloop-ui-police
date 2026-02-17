/**
 * Run management system
 *
 * Directory structure:
 *   captures/
 *     manifest.json                     ← global index
 *     {app}/
 *       {env}/
 *         {YYMMDD}-{NNN}/              ← run directory (per app+env)
 *           run-manifest.json
 *           login.png
 *           dashboard.png
 *       diffs/
 *         develop-vs-local/            ← cross-env comparison
 *         develop-260217-002-vs-001/   ← cross-run comparison
 *
 * Key behaviour:
 *   - Run IDs are scoped per app+env (each env has its own sequence).
 *   - If an incomplete run exists for app+env, it is resumed — no new run is created.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  GlobalManifest,
  RunManifest,
  RunSummary,
  ScreenshotEntry,
} from "../types/config";
import { formatDuration } from "../utils/terminal";

// ============================================
// PATHS
// ============================================

const CAPTURES_DIR = "output/captures";
const GLOBAL_MANIFEST_PATH = path.join(CAPTURES_DIR, "manifest.json");

export function getCapturesDir(): string {
  return CAPTURES_DIR;
}

export function getAppDir(app: string): string {
  return path.join(CAPTURES_DIR, app);
}

/** captures/{app}/{env} */
export function getEnvBaseDir(app: string, env: string): string {
  return path.join(getAppDir(app), env);
}

/** captures/{app}/{env}/{runId} — the run's root (screenshots live here) */
export function getRunDir(app: string, env: string, runId: string): string {
  return path.join(getEnvBaseDir(app, env), runId);
}

/** captures/{app}/diffs */
export function getDiffsDir(app: string): string {
  return path.join(getAppDir(app), "diffs");
}

/** captures/{app}/diffs/{label} */
export function getDiffPairDir(app: string, label: string): string {
  return path.join(getDiffsDir(app), label);
}

export function getRunManifestPath(app: string, env: string, runId: string): string {
  return path.join(getRunDir(app, env, runId), "run-manifest.json");
}

// ============================================
// GLOBAL MANIFEST
// ============================================

function createEmptyGlobalManifest(): GlobalManifest {
  return { totalRuns: 0, runs: [] };
}

export function loadGlobalManifest(): GlobalManifest {
  if (!existsSync(GLOBAL_MANIFEST_PATH)) return createEmptyGlobalManifest();
  try {
    return JSON.parse(readFileSync(GLOBAL_MANIFEST_PATH, "utf-8")) as GlobalManifest;
  } catch {
    return createEmptyGlobalManifest();
  }
}

export function saveGlobalManifest(manifest: GlobalManifest): void {
  if (!existsSync(CAPTURES_DIR)) mkdirSync(CAPTURES_DIR, { recursive: true });
  writeFileSync(GLOBAL_MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}

// ============================================
// RUN ID GENERATION — YYMMDD-NNN
// ============================================

function todayStamp(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/**
 * Generate the next sequential run ID for a given app+env.
 * Format: YYMMDD-NNN  (e.g., 260217-001)
 * Sequence number is scoped per app + env + date.
 */
export function nextRunId(app: string, env: string): string {
  const datePrefix = todayStamp();
  const manifest = loadGlobalManifest();

  const existing = manifest.runs
    .filter((r) => r.app === app && r.environment === env && r.runId.startsWith(datePrefix))
    .map((r) => {
      const seq = parseInt(r.runId.split("-")[1] ?? "0", 10);
      return isNaN(seq) ? 0 : seq;
    });

  const nextSeq = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${datePrefix}-${String(nextSeq).padStart(3, "0")}`;
}

// ============================================
// INCOMPLETE RUN DETECTION
// ============================================

/**
 * Find the latest incomplete (status === "running") run for an app+env.
 * Returns the run manifest if found, or null.
 */
export function findIncompleteRun(app: string, env: string): RunManifest | null {
  const global = loadGlobalManifest();
  const incompleteEntries = global.runs.filter(
    (r) => r.app === app && r.environment === env && r.status === "running",
  );
  if (incompleteEntries.length === 0) return null;

  // Return the most recent one
  const latest = incompleteEntries[incompleteEntries.length - 1]!;
  return loadRunManifest(app, env, latest.runId);
}

/**
 * Cancel an existing run (mark it as cancelled so a fresh one can start)
 */
export function cancelRun(app: string, env: string, runId: string): void {
  const manifest = loadRunManifest(app, env, runId);
  if (manifest) {
    manifest.status = "cancelled";
    writeFileSync(
      getRunManifestPath(app, env, runId),
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );
  }
  const global = loadGlobalManifest();
  const entry = global.runs.find((r) => r.runId === runId && r.app === app && r.environment === env);
  if (entry) {
    entry.status = "cancelled";
    saveGlobalManifest(global);
  }
}

// ============================================
// RUN LIFECYCLE
// ============================================

/**
 * Obtain a run for app+env. If an incomplete run exists, resume it.
 * Otherwise create a new one.
 * Returns { runId, startTime, resumed }.
 */
export function getOrCreateRun(
  app: string,
  env: string,
  baseUrl: string,
  version: string,
): {
  runId: string;
  startTime: number;
  resumed: boolean;
} {
  const incomplete = findIncompleteRun(app, env);
  if (incomplete) {
    // Resume — parse original timestamp to approximate startTime
    const originalStart = new Date(incomplete.timestamp).getTime();
    return { runId: incomplete.runId, startTime: originalStart, resumed: true };
  }

  return { ...createRun(app, env, baseUrl, version), resumed: false };
}

/**
 * Create a brand-new run — generates ID, directory, manifests.
 */
export function createRun(
  app: string,
  env: string,
  baseUrl: string,
  version: string,
): {
  runId: string;
  startTime: number;
} {
  const runId = nextRunId(app, env);
  const runDir = getRunDir(app, env, runId);
  mkdirSync(runDir, { recursive: true });

  const runManifest: RunManifest = {
    runId,
    app,
    environment: env,
    baseUrl,
    timestamp: new Date().toISOString(),
    duration: "",
    trigger: "manual",
    status: "running",
    version,
    pageCount: 0,
    interactionCount: 0,
    screenshots: [],
  };

  writeFileSync(
    getRunManifestPath(app, env, runId),
    JSON.stringify(runManifest, null, 2),
    "utf-8",
  );

  const globalManifest = loadGlobalManifest();
  globalManifest.totalRuns++;
  globalManifest.runs.push({
    runId,
    app,
    environment: env,
    timestamp: runManifest.timestamp,
    status: "running",
  });
  saveGlobalManifest(globalManifest);

  return { runId, startTime: Date.now() };
}

/**
 * Register a screenshot in the run manifest
 */
export function registerScreenshot(
  app: string,
  env: string,
  runId: string,
  entry: ScreenshotEntry,
): void {
  const manifest = loadRunManifest(app, env, runId);
  if (!manifest) return;

  manifest.screenshots.push(entry);
  if (entry.interactionId) {
    manifest.interactionCount++;
  } else {
    manifest.pageCount++;
  }

  writeFileSync(
    getRunManifestPath(app, env, runId),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}

/**
 * Generate a unique screenshot ID within a run
 */
export function nextScreenshotId(app: string, env: string, runId: string): string {
  const manifest = loadRunManifest(app, env, runId);
  if (!manifest) return "scr-001";
  const count = manifest.screenshots.length + 1;
  return `scr-${String(count).padStart(3, "0")}`;
}

/**
 * Complete a run — finalize duration, status, update global manifest
 */
export function completeRun(
  app: string,
  env: string,
  runId: string,
  startTime: number,
  status: "completed" | "failed" | "cancelled" = "completed",
): void {
  const runManifest = loadRunManifest(app, env, runId);
  if (runManifest) {
    runManifest.status = status;
    runManifest.duration = formatDuration(Date.now() - startTime);
    writeFileSync(
      getRunManifestPath(app, env, runId),
      JSON.stringify(runManifest, null, 2),
      "utf-8",
    );
  }

  const globalManifest = loadGlobalManifest();
  const entry = globalManifest.runs.find(
    (r) => r.runId === runId && r.app === app && r.environment === env,
  );
  if (entry) {
    entry.status = status;
    saveGlobalManifest(globalManifest);
  }
}

// ============================================
// RUN QUERIES
// ============================================

/**
 * Load a run's manifest
 */
export function loadRunManifest(app: string, env: string, runId: string): RunManifest | null {
  const manifestPath = getRunManifestPath(app, env, runId);
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8")) as RunManifest;
  } catch {
    return null;
  }
}

/**
 * List all runs, optionally filtered by app and/or env
 */
export function listRuns(app?: string, env?: string): RunSummary[] {
  const manifest = loadGlobalManifest();
  let runs = manifest.runs;
  if (app) runs = runs.filter((r) => r.app === app);
  if (env) runs = runs.filter((r) => r.environment === env);
  return runs;
}

/**
 * Find the latest completed run for a given app+env
 */
export function getLatestCompletedRun(app: string, env: string): RunSummary | null {
  const runs = listRuns(app, env).filter((r) => r.status === "completed");
  return runs.length > 0 ? runs[runs.length - 1]! : null;
}

/**
 * Find the latest run (any status) for a given app — used for display
 */
export function getLatestRun(app: string): RunSummary | null {
  const runs = listRuns(app);
  return runs.length > 0 ? runs[runs.length - 1]! : null;
}

/**
 * Get total number of runs
 */
export function getTotalRuns(): number {
  return loadGlobalManifest().totalRuns;
}
