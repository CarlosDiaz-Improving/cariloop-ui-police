import fs from "fs";
import path from "path";
import { spawn } from "child_process";

// Core imports
import { captureAll } from "./core/capture";
import { compareScreenshots } from "./core/compare";
import { generateReport, generateMainIndex } from "./core/report";
import { 
  environments,
  getOutputDir, 
  setCurrentApp, 
  getCurrentApp,
  getCurrentAppConfig,
  APPS,
  APP_LIST,
  projectConfig,
} from "./core/config";
import {
  loadProgress,
  deleteProgress,
  allEnvironmentsComplete,
  hasEnvironmentMismatch,
  type ProgressManifest,
} from "./core/progress";
import {
  loadLog,
  type InteractionLog,
} from "./core/logger";
import { listRuns, getTotalRuns, getLatestRun, getAppDir, loadRunManifest } from "./core/runs";
import { startRecording, saveRecordedScript, listScripts } from "./core/recorder";

// Utils imports
import { 
  printBanner, 
  printMenu, 
  printAppSelected,
  printComparisonSummary,
  printMinikubeReminder,
  printReloadHint,
  log, 
  style, 
  symbols 
} from "./utils/terminal";

type RunMode = "fresh" | "resume" | "compare-only" | "retry-failed" | "record";

function promptUser(question: string): string {
  const answer = prompt(question);
  return answer?.trim() ?? "";
}

function selectApp(): string {
  const options = APP_LIST.map((app, index) => {
    const config = APPS[app]!;
    return { key: (index + 1).toString(), label: config.displayName };
  });
  
  printMenu("Select application to test", options);
  
  const choice = promptUser(`Your choice ${style.muted("[1]")}: `);
  const index = parseInt(choice || "1", 10) - 1;
  
  if (index >= 0 && index < APP_LIST.length) {
    return APP_LIST[index]!;
  }
  return APP_LIST[0] ?? "admin";
}

function selectEnvironment(): string {
  const options = environments.map((env, index) => ({
    key: (index + 1).toString(),
    label: `${env.name} (${env.baseUrl})`,
  }));

  printMenu("Select environment", options);

  const choice = promptUser(`Your choice ${style.muted("[1]")}: `);
  const index = parseInt(choice || "1", 10) - 1;

  if (index >= 0 && index < environments.length) {
    return environments[index]!.name;
  }
  return environments[0]?.name ?? "develop";
}

function discoverPagesFromDisk(): string[] {
  // Try to discover pages from the latest completed run
  const appName = getCurrentApp();
  const appRuns = listRuns(appName);
  const latestCompleted = appRuns.filter((r) => r.status === "completed").pop();
  if (!latestCompleted) return [];
  const manifest = loadRunManifest(appName, latestCompleted.environment, latestCompleted.runId);
  if (!manifest) return [];
  return manifest.screenshots
    .filter((s) => !s.interactionId)
    .map((s) => s.page);
}

function deleteAllScreenshots(): void {
  const appDir = getAppDir(getCurrentApp());
  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true });
  }
  deleteProgress();
  log.action("Cleared all captures, progress, and logs");
}

function printProgressSummary(manifest: ProgressManifest): void {
  console.log(`\n${style.header("Previous Progress")}`);
  console.log(`  ${symbols.bullet} Discovered pages: ${style.count(manifest.discoveredPages.length.toString())}`);
  console.log(`  ${symbols.bullet} Environments:`);
  for (const [env, progress] of Object.entries(manifest.environments)) {
    const complete = progress.complete ? style.success("complete") : style.warning("partial");
    console.log(`    ${symbols.tee} ${env}: ${complete} (${progress.capturedPages.length} pages)`);
  }
  console.log("");
}

function printLogSummary(interactionLog: InteractionLog): void {
  console.log(`\n${style.header("Interaction Log")}`);
  console.log(`  ${symbols.bullet} Total: ${style.count(interactionLog.summary.total.toString())}`);
  console.log(`    ${symbols.tee} ${style.success(`${symbols.check} Success: ${interactionLog.summary.success}`)}`);
  console.log(`    ${symbols.tee} ${style.error(`${symbols.cross} Failed: ${interactionLog.summary.failed}`)}`);
  console.log(`    ${symbols.corner} ${style.muted(`${symbols.arrow} Skipped: ${interactionLog.summary.skipped}`)}`);
  console.log("");
}

function determineRunMode(existing: ProgressManifest | null, existingLog: InteractionLog | null): RunMode {
  // Always show the main action menu
  const appName = getCurrentApp();
  const appRuns = listRuns(appName);
  const totalRuns = getTotalRuns();

  if (appRuns.length > 0) {
    console.log(`  ${style.muted(`Run history: ${appRuns.length} runs for this app (${totalRuns} total)`)}\n`);
  }

  const options = [
    { key: "1", label: "Capture screenshots (fresh run)" },
    { key: "2", label: "Compare only (latest runs)" },
    { key: "3", label: "Record custom script" },
  ];

  if (existing) {
    printProgressSummary(existing);
    if (existingLog && existingLog.summary.total > 0) {
      printLogSummary(existingLog);
    }

    if (!allEnvironmentsComplete(existing)) {
      options.splice(1, 0, { key: "2", label: "Resume capture" });
      // Re-number
      options.forEach((o, i) => { o.key = (i + 1).toString(); });
    }

    if (existingLog && existingLog.summary.failed > 0) {
      options.push({ key: (options.length + 1).toString(), label: "Retry failed interactions" });
    }
  }

  printMenu("What would you like to do?", options);

  const choice = promptUser(`Your choice ${style.muted("[1]")}: `);
  const selected = options.find((o) => o.key === (choice || "1"));

  if (!selected) return "fresh";

  if (selected.label.includes("fresh")) return "fresh";
  if (selected.label.includes("Resume")) return "resume";
  if (selected.label.includes("Compare")) return "compare-only";
  if (selected.label.includes("Retry")) return "retry-failed";
  if (selected.label.includes("Record")) return "record";

  return "fresh";
}

async function runFresh(): Promise<{ pages: string[]; log: InteractionLog; runIds: Record<string, string> }> {
  deleteAllScreenshots();
  log.step("Step 1: Capturing screenshots...");
  const { pages, log: interactionLog, runIds } = await captureAll();
  return { pages, log: interactionLog, runIds };
}

async function runResume(manifest: ProgressManifest, interactionLog: InteractionLog | null): Promise<{ pages: string[]; log: InteractionLog; runIds: Record<string, string> }> {
  log.step("Step 1: Resuming screenshot capture...");
  const result = await captureAll(manifest, interactionLog ?? undefined);
  return { pages: result.pages, log: result.log, runIds: result.runIds };
}

async function runRetryFailed(manifest: ProgressManifest, existingLog: InteractionLog): Promise<{ pages: string[]; log: InteractionLog; runIds: Record<string, string> }> {
  log.step("Step 1: Retrying failed interactions...");
  const result = await captureAll(manifest, existingLog);
  return { pages: result.pages, log: result.log, runIds: result.runIds };
}

function runCompareOnly(manifest: ProgressManifest | null): { pages: string[]; log: InteractionLog | null } {
  log.step("Step 1: Skipping capture (compare-only mode)");
  if (manifest && manifest.discoveredPages.length > 0) {
    return { pages: manifest.discoveredPages, log: null };
  }
  // Fallback: discover pages from files on disk
  const pages = discoverPagesFromDisk();
  if (pages.length === 0) {
    log.error("No screenshots found on disk. Cannot compare.");
    process.exit(1);
  }
  console.log(`  ${style.muted(`Found ${pages.length} pages from existing screenshots.`)}`);
  return { pages, log: null };
}

async function runRecorder(): Promise<void> {
  const appName = getCurrentApp();
  const envName = selectEnvironment();

  const code = await startRecording(appName, envName);
  if (!code) {
    log.warning("No script was generated.");
    return;
  }

  const name = promptUser(`Script name ${style.muted("[auto]")}: `) || undefined;
  saveRecordedScript(appName, code, name);

  // Show available scripts
  const scripts = listScripts(appName);
  if (scripts.length > 0) {
    console.log(`\n  ${style.muted(`${scripts.length} script(s) available for ${appName}:`)}`);
    for (const s of scripts) {
      console.log(`    ${symbols.bullet} ${style.highlight(s.name)} — ${s.description}`);
    }
  }
}

async function main() {
  printBanner();
  console.log(`  ${style.muted(`v${projectConfig.version}`)}\n`);

  // Step 0: Select app
  const selectedApp = selectApp();
  setCurrentApp(selectedApp);
  const appConfig = getCurrentAppConfig();
  
  printAppSelected(appConfig.displayName, getAppDir(getCurrentApp()), appConfig.pathPrefix);

  // Show Minikube reminder for local environment testing
  printMinikubeReminder();
  printReloadHint();

  const existing = loadProgress();
  const existingLog = loadLog();
  const mode = determineRunMode(existing, existingLog.summary.total > 0 ? existingLog : null);

  // Handle recorder mode separately
  if (mode === "record") {
    await runRecorder();
    return;
  }

  let pages: string[];
  let interactionLog: InteractionLog | null = null;
  let runIds: Record<string, string> = {};

  switch (mode) {
    case "fresh": {
      const freshResult = await runFresh();
      pages = freshResult.pages;
      interactionLog = freshResult.log;
      runIds = freshResult.runIds;
      break;
    }
    case "resume": {
      const resumeResult = await runResume(existing!, existingLog.summary.total > 0 ? existingLog : null);
      pages = resumeResult.pages;
      interactionLog = resumeResult.log;
      runIds = resumeResult.runIds;
      break;
    }
    case "retry-failed": {
      const retryResult = await runRetryFailed(existing!, existingLog);
      pages = retryResult.pages;
      interactionLog = retryResult.log;
      runIds = retryResult.runIds;
      break;
    }
    case "compare-only": {
      const compareResult = runCompareOnly(existing);
      pages = compareResult.pages;
      interactionLog = compareResult.log;
      break;
    }
  }

  // Step 2: Compare screenshots
  log.step("Step 2: Comparing screenshots...");
  const results = compareScreenshots(pages);

  // Step 3: Generate HTML report
  log.step("Step 3: Generating report...");
  const reportPath = generateReport(results);
  
  // Step 4: Update main index
  log.step("Step 4: Updating main index...");
  generateMainIndex();

  // Final summary
  const avgDiff =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.diffPercentage, 0) / results.length
      : 0;
  
  printComparisonSummary(results.length, avgDiff, reportPath);
  
  // Show interaction summary
  if (interactionLog) {
    console.log(`\n  ${style.info("Interactions:")} ${style.success(`${symbols.check} ${interactionLog.summary.success}`)} success, ${style.error(`${symbols.cross} ${interactionLog.summary.failed}`)} failed`);
    if (interactionLog.summary.failed > 0) {
      console.log(`  ${style.muted(`See: ${getAppDir(getCurrentApp())}/failure-report.md for details`)}`);
    }
  }
  
  console.log("");
  
  // Open main index in browser
  log.action("Opening reports dashboard in browser...");
  const mainIndexPath = path.resolve("output/reports/index.html");
  
  // Use 'open' on macOS, 'xdg-open' on Linux, 'start' on Windows
  const openCommand = process.platform === "darwin" ? "open" 
    : process.platform === "win32" ? "start" 
    : "xdg-open";
  
  spawn(openCommand, [mainIndexPath], { 
    detached: true, 
    stdio: "ignore" 
  }).unref();
  
  console.log("");
  
  // Show option to run again
  console.log(`  ${style.dim("Press")} ${style.orange("'r'")} ${style.dim("to run again")}`);
  console.log("");
}

main().catch((err) => {
  log.error(`Fatal error: ${err}`);
  process.exit(1);
});
