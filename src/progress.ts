import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { screenshotsDir, environments } from "./config";

const PROGRESS_FILE = path.join(screenshotsDir, "progress.json");

export interface EnvironmentProgress {
  capturedPages: string[];
  complete: boolean;
  lastUpdated: string;
}

export interface ProgressManifest {
  discoveredPages: string[];
  environments: Record<string, EnvironmentProgress>;
}

export function loadProgress(): ProgressManifest | null {
  if (!existsSync(PROGRESS_FILE)) return null;
  try {
    const text = readFileSync(PROGRESS_FILE, "utf-8");
    return JSON.parse(text) as ProgressManifest;
  } catch {
    return null;
  }
}

export function saveProgress(manifest: ProgressManifest): void {
  const dir = path.dirname(PROGRESS_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(PROGRESS_FILE, JSON.stringify(manifest, null, 2), "utf-8");
}

export function deleteProgress(): void {
  if (existsSync(PROGRESS_FILE)) {
    unlinkSync(PROGRESS_FILE);
  }
}

export function createFreshManifest(): ProgressManifest {
  const envs: Record<string, EnvironmentProgress> = {};
  for (const env of environments) {
    envs[env.name] = {
      capturedPages: [],
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

function pathToFilename(pagePath: string): string {
  return pagePath.replace(/^\//, "").replace(/\//g, "-") + ".png";
}

export function isPageCaptured(
  manifest: ProgressManifest,
  envName: string,
  pagePath: string
): boolean {
  const env = manifest.environments[envName];
  if (!env) return false;
  if (!env.capturedPages.includes(pagePath)) return false;
  // Also verify the file actually exists on disk
  const filepath = path.join(screenshotsDir, envName, pathToFilename(pagePath));
  return existsSync(filepath);
}

export function isEnvironmentComplete(
  manifest: ProgressManifest,
  envName: string
): boolean {
  const env = manifest.environments[envName];
  return env?.complete ?? false;
}

export function allEnvironmentsComplete(manifest: ProgressManifest): boolean {
  return environments.every((e) => isEnvironmentComplete(manifest, e.name));
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
    console.log(`  ${env.name}: ${ep.capturedPages.length} pages captured (${status})`);
  }
  console.log("------------------------\n");
}
