/**
 * Playwright Recorder — wraps Playwright's codegen to record custom scripts.
 *
 * Opens a headed browser for the selected app/environment, lets the user
 * interact manually, and saves the generated Playwright code as a reusable script.
 */

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from "fs";
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

// ============================================
// CODEGEN PROCESS TRACKING
// ============================================

let activeCodegenProcess: ReturnType<typeof spawn> | null = null;

/**
 * Check if a codegen process is currently active
 */
export function isCodegenRunning(): boolean {
  return activeCodegenProcess !== null;
}

/**
 * Stop the currently running codegen process
 */
export function stopRecording(): void {
  if (activeCodegenProcess) {
    try {
      activeCodegenProcess.kill("SIGTERM");
    } catch { /* already dead */ }
    activeCodegenProcess = null;
    log.warning("Recording stopped by user");
  }
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

  return new Promise<string | null>((resolve) => {
    const child = spawn("bunx", ["playwright", "codegen", "--target=javascript", targetUrl], {
      stdio: ["inherit", "pipe", "pipe"],
    });

    activeCodegenProcess = child;
    let stdout = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.on("close", () => {
      activeCodegenProcess = null;
      const trimmed = stdout.trim();
      if (trimmed.length > 0) {
        log.success("Recording captured successfully");
        resolve(trimmed);
      } else {
        log.warning("Recording session ended without captured actions");
        resolve(null);
      }
    });

    child.on("error", () => {
      activeCodegenProcess = null;
      log.warning("Recording session ended without captured actions");
      resolve(null);
    });
  });
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

/**
 * Execute all registered scripts for an app.
 * Runs each script sequentially. Returns the number of scripts executed.
 * This is called by the capture pipeline after page captures.
 */
export async function executeAllScripts(appName: string): Promise<number> {
  const scripts = listScripts(appName);
  if (scripts.length === 0) return 0;

  log.header(`Running ${scripts.length} recorded script(s)`);
  let executed = 0;

  for (const script of scripts) {
    const success = await runScript(appName, script.name);
    if (success) executed++;
  }

  if (executed > 0) {
    log.success(`${executed}/${scripts.length} scripts completed`);
  }
  return executed;
}

/**
 * Execute only selected scripts (by name) for an app.
 * Returns the number of scripts that executed successfully.
 */
export async function executeSelectedScripts(appName: string, scriptNames: string[]): Promise<number> {
  if (scriptNames.length === 0) return 0;

  log.header(`Running ${scriptNames.length} selected script(s)`);
  let executed = 0;

  for (const name of scriptNames) {
    const success = await runScript(appName, name);
    if (success) executed++;
  }

  if (executed > 0) {
    log.success(`${executed}/${scriptNames.length} scripts completed`);
  }
  return executed;
}

/**
 * Check if an app has any registered scripts
 */
export function hasScripts(appName: string): boolean {
  return listScripts(appName).length > 0;
}

/**
 * Get the content of a saved script
 */
export function getScriptContent(appName: string, scriptName: string): string | null {
  const registry = loadRegistry(appName);
  const script = registry.find((s) => s.name === scriptName);
  if (!script) return null;

  const filepath = path.join(getScriptsDir(appName), script.file);
  if (!existsSync(filepath)) return null;
  return readFileSync(filepath, "utf-8");
}

/**
 * Save a raw script (pasted from codegen) directly to disk and register it.
 * Unlike saveRecordedScript, this does NOT wrap the code — it saves as-is.
 */
export function saveRawScript(
  appName: string,
  code: string,
  scriptName: string,
  description?: string,
): string {
  const dir = getScriptsDir(appName);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filename = `${scriptName}.ts`;
  const filepath = path.join(dir, filename);
  writeFileSync(filepath, code, "utf-8");

  // Register if not already registered
  const registry = loadRegistry(appName);
  const existing = registry.findIndex((s) => s.name === scriptName);
  if (existing >= 0) {
    registry[existing]!.description = description ?? registry[existing]!.description;
  } else {
    registry.push({
      name: scriptName,
      file: filename,
      description: description ?? `Script (${new Date().toLocaleDateString()})`,
      createdAt: new Date().toISOString(),
    });
  }
  saveRegistry(appName, registry);
  return filepath;
}

/**
 * Update an existing script's content and/or description
 */
export function updateScript(
  appName: string,
  scriptName: string,
  code?: string,
  description?: string,
): boolean {
  const registry = loadRegistry(appName);
  const idx = registry.findIndex((s) => s.name === scriptName);
  if (idx < 0) return false;

  if (code !== undefined) {
    const filepath = path.join(getScriptsDir(appName), registry[idx]!.file);
    writeFileSync(filepath, code, "utf-8");
  }
  if (description !== undefined) {
    registry[idx]!.description = description;
  }
  saveRegistry(appName, registry);
  return true;
}

/**
 * Delete a script from disk and registry
 */
export function deleteScript(appName: string, scriptName: string): boolean {
  const registry = loadRegistry(appName);
  const idx = registry.findIndex((s) => s.name === scriptName);
  if (idx < 0) return false;

  const filepath = path.join(getScriptsDir(appName), registry[idx]!.file);
  if (existsSync(filepath)) {
    unlinkSync(filepath);
  }

  registry.splice(idx, 1);
  saveRegistry(appName, registry);
  return true;
}
