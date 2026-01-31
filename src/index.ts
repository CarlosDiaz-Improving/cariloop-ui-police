import fs from "fs";
import path from "path";

// Core imports
import { captureAll } from "./core/capture";
import { compareScreenshots } from "./core/compare";
import { generateReport } from "./core/report";
import { 
  getScreenshotsDir, 
  setCurrentApp, 
  getCurrentAppConfig,
  APPS,
  type AppType 
} from "./core/config";
import {
  loadProgress,
  deleteProgress,
  allEnvironmentsComplete,
  type ProgressManifest,
} from "./core/progress";
import {
  loadLog,
  type InteractionLog,
} from "./core/logger";

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

type RunMode = "fresh" | "resume" | "compare-only" | "retry-failed";

const APP_CHOICES: AppType[] = ["admin", "plan", "coach", "auth"];

function promptUser(question: string): string {
  const answer = prompt(question);
  return answer?.trim() ?? "";
}

function selectApp(): AppType {
  const options = APP_CHOICES.map((app, index) => {
    const config = APPS[app];
    return { key: (index + 1).toString(), label: config.displayName };
  });
  
  printMenu("Select application to test", options);
  
  const choice = promptUser(`Your choice ${style.muted("[1]")}: `);
  const index = parseInt(choice || "1", 10) - 1;
  
  if (index >= 0 && index < APP_CHOICES.length) {
    return APP_CHOICES[index]!;
  }
  return "admin";
}

function discoverPagesFromDisk(): string[] {
  const screenshotsDir = getScreenshotsDir();
  const devDir = path.join(screenshotsDir, "dev");
  if (!fs.existsSync(devDir)) return [];
  const files = fs.readdirSync(devDir).filter((f) => f.endsWith(".png") && !f.includes("__"));
  return files.map((f) => "/" + f.replace(".png", "").replace(/-/g, "/"));
}

function deleteAllScreenshots(): void {
  const screenshotsDir = getScreenshotsDir();
  const dirs = ["dev", "local", "diff"].map((d) => path.join(screenshotsDir, d));
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  }
  deleteProgress();
  // Also delete log files
  const logFile = path.join(screenshotsDir, "interaction-log.json");
  const reportFile = path.join(screenshotsDir, "failure-report.md");
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  if (fs.existsSync(reportFile)) fs.unlinkSync(reportFile);
  log.action("Cleared all screenshots, progress, and logs");
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
  if (!existing) {
    log.step("No previous progress found. Starting fresh capture.");
    return "fresh";
  }

  printProgressSummary(existing);
  
  // Show log summary if exists
  if (existingLog && existingLog.summary.total > 0) {
    printLogSummary(existingLog);
  }

  if (allEnvironmentsComplete(existing)) {
    console.log(`${style.info("All environments were fully captured in a previous run.")}\n`);
    
    const options = [
      { key: "1", label: "Compare only (skip capture)" },
      { key: "2", label: "Restart fresh (delete all and recapture)" },
    ];
    if (existingLog && existingLog.summary.failed > 0) {
      options.push({ key: "3", label: "Retry failed interactions only" });
    }
    printMenu("What would you like to do?", options.map((o, i) => ({ key: o.key, label: o.label })));
    
    const choice = promptUser(`Your choice ${style.muted("[1]")}: `);
    if (choice === "2") return "fresh";
    if (choice === "3" && existingLog?.summary.failed) return "retry-failed";
    return "compare-only";
  }

  // Partial progress
  console.log(`${style.warning("Previous run was interrupted.")}\n`);
  
  const options = [
    { key: "1", label: "Resume (continue where it left off)" },
    { key: "2", label: "Restart fresh (delete all and recapture)" },
    { key: "3", label: "Compare only (use whatever screenshots exist)" },
  ];
  if (existingLog && existingLog.summary.failed > 0) {
    options.push({ key: "4", label: "Retry failed interactions only" });
  }
  printMenu("What would you like to do?", options.map((o) => ({ key: o.key, label: o.label })));
  
  const choice = promptUser(`Your choice ${style.muted("[1]")}: `);
  if (choice === "2") return "fresh";
  if (choice === "3") return "compare-only";
  if (choice === "4" && existingLog?.summary.failed) return "retry-failed";
  return "resume";
}

async function runFresh(): Promise<{ pages: string[]; log: InteractionLog }> {
  deleteAllScreenshots();
  log.step("Step 1: Capturing screenshots...");
  const { pages, log: interactionLog } = await captureAll();
  return { pages, log: interactionLog };
}

async function runResume(manifest: ProgressManifest, interactionLog: InteractionLog | null): Promise<{ pages: string[]; log: InteractionLog }> {
  log.step("Step 1: Resuming screenshot capture...");
  const result = await captureAll(manifest, interactionLog ?? undefined);
  return { pages: result.pages, log: result.log };
}

async function runRetryFailed(manifest: ProgressManifest, existingLog: InteractionLog): Promise<{ pages: string[]; log: InteractionLog }> {
  log.step("Step 1: Retrying failed interactions...");
  const result = await captureAll(manifest, existingLog);
  return { pages: result.pages, log: result.log };
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

async function main() {
  printBanner();

  // Step 0: Select app
  const selectedApp = selectApp();
  setCurrentApp(selectedApp);
  const appConfig = getCurrentAppConfig();
  
  printAppSelected(appConfig.displayName, getScreenshotsDir(), appConfig.pathPrefix);

  // Show Minikube reminder for local environment testing
  printMinikubeReminder();
  printReloadHint();

  const existing = loadProgress();
  const existingLog = loadLog();
  const mode = determineRunMode(existing, existingLog.summary.total > 0 ? existingLog : null);

  let pages: string[];
  let interactionLog: InteractionLog | null = null;

  switch (mode) {
    case "fresh":
      const freshResult = await runFresh();
      pages = freshResult.pages;
      interactionLog = freshResult.log;
      break;
    case "resume":
      const resumeResult = await runResume(existing!, existingLog.summary.total > 0 ? existingLog : null);
      pages = resumeResult.pages;
      interactionLog = resumeResult.log;
      break;
    case "retry-failed":
      const retryResult = await runRetryFailed(existing!, existingLog);
      pages = retryResult.pages;
      interactionLog = retryResult.log;
      break;
    case "compare-only":
      const compareResult = runCompareOnly(existing);
      pages = compareResult.pages;
      interactionLog = compareResult.log;
      break;
  }

  // Step 2: Compare screenshots
  log.step("Step 2: Comparing screenshots...");
  const results = compareScreenshots(pages);

  // Step 3: Generate HTML report
  log.step("Step 3: Generating report...");
  const reportPath = generateReport(results);

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
      console.log(`  ${style.muted(`See: ${getScreenshotsDir()}/failure-report.md for details`)}`);
    }
  }
  
  console.log("");
  
  // Show option to run again
  console.log(`  ${style.dim("To run again, use")} ${style.orange("bun run start")}`);
  console.log("");
}

main().catch((err) => {
  log.error(`Fatal error: ${err}`);
  process.exit(1);
});
