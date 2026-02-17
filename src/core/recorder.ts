/**
 * Playwright Recorder — wraps Playwright's codegen to record custom scripts.
 *
 * Opens a headed browser for the selected app/environment, lets the user
 * interact manually, and saves the generated Playwright code as a reusable script.
 */

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { environments, getAppConfig } from "./config";
import { getCapturesDir } from "./runs";
import { log, style, symbols } from "../utils/terminal";
import type { CustomScript } from "../types/config";

// ============================================
// PATHS
// ============================================

function getScriptsDir(appName: string): string {
  return path.join(getCapturesDir(), "scripts", appName);
}

function getScriptRegistryPath(appName: string): string {
  return path.join(getScriptsDir(appName), "registry.json");
}

// ============================================
// SCRIPT REGISTRY
// ============================================

function loadRegistry(appName: string): CustomScript[] {
  const registryPath = getScriptRegistryPath(appName);
  if (!existsSync(registryPath)) return [];
  try {
    const content = readFileSync(registryPath, "utf-8");
    return JSON.parse(content) as CustomScript[];
  } catch {
    return [];
  }
}

function saveRegistry(appName: string, scripts: CustomScript[]): void {
  const dir = getScriptsDir(appName);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getScriptRegistryPath(appName), JSON.stringify(scripts, null, 2), "utf-8");
}

// ============================================
// PUBLIC API
// ============================================

/**
 * List available scripts for an app
 */
export function listScripts(appName: string): CustomScript[] {
  return loadRegistry(appName);
}

/**
 * Start the Playwright codegen recorder for a specific app and environment.
 * This spawns an interactive browser session — the user interacts with it
 * and closes it when done. The generated code is printed to stdout.
 */
export async function startRecording(
  appName: string,
  envName: string,
): Promise<string | null> {
  const env = environments.find((e) => e.name === envName);
  if (!env) {
    log.error(`Unknown environment: ${envName}`);
    return null;
  }

  const appConfig = getAppConfig(appName);
  const targetUrl = env.baseUrl;

  log.header(`Recording: ${appConfig.displayName} (${envName})`);
  console.log(`  ${style.url(targetUrl)}`);
  console.log(`  ${style.muted("Interact with the browser. Close it when done.")}\n`);

  try {
    // Use Playwright codegen with --target=javascript
    // The output goes to stdout; we capture it
    const output = execSync(
      `npx playwright codegen --target=javascript "${targetUrl}"`,
      {
        encoding: "utf-8",
        stdio: ["inherit", "pipe", "inherit"],
        timeout: 600_000, // 10-minute max session
      }
    );

    if (output && output.trim().length > 0) {
      log.success("Recording captured successfully");
      return output.trim();
    }

    log.warning("No actions were recorded");
    return null;
  } catch (err: any) {
    // User closing the browser causes a non-zero exit — that's expected
    if (err.stdout && err.stdout.trim().length > 0) {
      log.success("Recording captured successfully");
      return err.stdout.trim();
    }
    log.warning("Recording session ended without captured actions");
    return null;
  }
}

/**
 * Save recorded script to disk and register it
 */
export function saveRecordedScript(
  appName: string,
  code: string,
  scriptName?: string,
): string {
  const dir = getScriptsDir(appName);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Generate a name if not provided
  const name = scriptName ?? `recorded-${Date.now()}`;
  const filename = `${name}.ts`;
  const filepath = path.join(dir, filename);

  // Wrap the raw code in a Playwright test structure
  const wrappedCode = `/**
 * Recorded Playwright script for ${appName}
 * Generated: ${new Date().toISOString()}
 */

import { chromium } from "playwright";

async function run() {
${code.split("\n").map((line) => `  ${line}`).join("\n")}
}

run().catch(console.error);
`;

  writeFileSync(filepath, wrappedCode, "utf-8");

  // Register it
  const registry = loadRegistry(appName);
  registry.push({
    name,
    file: filename,
    description: `Recorded script (${new Date().toLocaleDateString()})`,
    createdAt: new Date().toISOString(),
  });
  saveRegistry(appName, registry);

  log.fileSaved(filepath, "Script saved");
  return filepath;
}

/**
 * Run a saved script by name
 */
export async function runScript(
  appName: string,
  scriptName: string,
): Promise<boolean> {
  const registry = loadRegistry(appName);
  const script = registry.find((s) => s.name === scriptName);
  if (!script) {
    log.error(`Script not found: ${scriptName}`);
    return false;
  }

  const filepath = path.join(getScriptsDir(appName), script.file);
  if (!existsSync(filepath)) {
    log.error(`Script file missing: ${filepath}`);
    return false;
  }

  log.action(`Running script: ${style.highlight(scriptName)}`);

  try {
    execSync(`bun run "${filepath}"`, {
      stdio: "inherit",
      timeout: 120_000,
    });
    log.success("Script completed successfully");
    return true;
  } catch (err) {
    log.error(`Script failed: ${err}`);
    return false;
  }
}
