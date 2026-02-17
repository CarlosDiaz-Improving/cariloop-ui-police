import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { environments, getCurrentApp } from "./config";
import { getAppDir } from "./runs";

function getProgressFile(): string {
  return path.join(getAppDir(getCurrentApp()), "progress.json");
}

export interface EnvironmentProgress {
  capturedPages: string[];
  /** Map of pagePath -> array of captured interaction IDs */
  capturedInteractions: Record<string, string[]>;
  complete: boolean;
  lastUpdated: string;
}

export interface ProgressManifest {
  discoveredPages: string[];
  environments: Record<string, EnvironmentProgress>;
}

export function loadProgress(): ProgressManifest | null {
  const progressFile = getProgressFile();
  if (!existsSync(progressFile)) return null;
  try {
    const text = readFileSync(progressFile, "utf-8");
    return JSON.parse(text) as ProgressManifest;
  } catch {
    return null;
  }
}

export function saveProgress(manifest: ProgressManifest): void {
  const progressFile = getProgressFile();
  const dir = path.dirname(progressFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(progressFile, JSON.stringify(manifest, null, 2), "utf-8");
}

export function deleteProgress(): void {
  const progressFile = getProgressFile();
  if (existsSync(progressFile)) {
    unlinkSync(progressFile);
  }
}

export function createFreshManifest(): ProgressManifest {
  const envs: Record<string, EnvironmentProgress> = {};
  for (const env of environments) {
    envs[env.name] = {
      capturedPages: [],
      capturedInteractions: {},
      complete: false,
      lastUpdated: new Date().toISOString(),
    };
  }
  return { discoveredPages: [], environments: envs };
}

export function markPageCaptured(
  manifest: ProgressManifest,
  envName: string,
  pagePath: string
): void {
  const env = manifest.environments[envName];
  if (!env) return;
  if (!env.capturedPages.includes(pagePath)) {
    env.capturedPages.push(pagePath);
  }
  env.lastUpdated = new Date().toISOString();
  saveProgress(manifest);
}

export function markEnvironmentComplete(
  manifest: ProgressManifest,
  envName: string
): void {
  const env = manifest.environments[envName];
  if (!env) return;
  env.complete = true;
  env.lastUpdated = new Date().toISOString();
  saveProgress(manifest);
}

export function isPageCaptured(
  manifest: ProgressManifest,
  envName: string,
  pagePath: string
): boolean {
  const env = manifest.environments[envName];
  if (!env) return false;
  return env.capturedPages.includes(pagePath);
}

export function isInteractionCaptured(
  manifest: ProgressManifest,
  envName: string,
  pagePath: string,
  interactionId: string
): boolean {
  const env = manifest.environments[envName];
  if (!env) return false;
  if (!env.capturedInteractions) {
    env.capturedInteractions = {};
  }
  const interactions = env.capturedInteractions[pagePath] ?? [];
  return interactions.includes(interactionId);
}

export function markInteractionCaptured(
  manifest: ProgressManifest,
  envName: string,
  pagePath: string,
  interactionId: string
): void {
  const env = manifest.environments[envName];
  if (!env) return;
  // Initialize capturedInteractions if not present
  if (!env.capturedInteractions) {
    env.capturedInteractions = {};
  }
  if (!env.capturedInteractions[pagePath]) {
    env.capturedInteractions[pagePath] = [];
  }
  if (!env.capturedInteractions[pagePath].includes(interactionId)) {
    env.capturedInteractions[pagePath].push(interactionId);
  }
  env.lastUpdated = new Date().toISOString();
  saveProgress(manifest);
}

export function isEnvironmentComplete(
  manifest: ProgressManifest,
  envName: string
): boolean {
  const env = manifest.environments[envName];
  if (!env?.complete) return false;
  
  // Also verify that the environment has captured the expected number of pages
  const expectedPages = manifest.discoveredPages.length;
  if (expectedPages > 0 && env.capturedPages.length < expectedPages) {
    return false; // Incomplete - fewer pages than discovered
  }
  
  return true;
}

export function allEnvironmentsComplete(manifest: ProgressManifest): boolean {
  return environments.every((e) => isEnvironmentComplete(manifest, e.name));
}

/**
 * Check if there's a mismatch between environments (one has more pages than another)
 */
export function hasEnvironmentMismatch(manifest: ProgressManifest): boolean {
  const pageCounts = environments.map((e) => {
    const env = manifest.environments[e.name];
    return env?.capturedPages.length ?? 0;
  });
  
  // If any environment has pages but counts differ
  const maxPages = Math.max(...pageCounts);
  const minPages = Math.min(...pageCounts);
  
  return maxPages > 0 && minPages < maxPages;
}

export function printProgressSummary(manifest: ProgressManifest): void {
  console.log("\n--- Progress Summary ---");
  if (manifest.discoveredPages.length > 0) {
    console.log(`Discovered pages: ${manifest.discoveredPages.length}`);
  }
  for (const env of environments) {
    const ep = manifest.environments[env.name];
    if (!ep) {
      console.log(`  ${env.name}: no data`);
      continue;
    }
    const status = ep.complete ? "COMPLETE" : "in progress";
    const interactionCount = ep.capturedInteractions
      ? Object.values(ep.capturedInteractions).reduce((sum, arr) => sum + arr.length, 0)
      : 0;
    console.log(`  ${env.name}: ${ep.capturedPages.length} pages, ${interactionCount} interactions (${status})`);
  }
  console.log("------------------------\n");
}
