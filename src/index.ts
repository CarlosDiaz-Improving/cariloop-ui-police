import fs from "fs";
import path from "path";
import { captureAll } from "./capture";
import { compareScreenshots } from "./compare";
import { generateReport } from "./report";
import { 
  getScreenshotsDir, 
  setCurrentApp, 
  getCurrentApp, 
  getCurrentAppConfig,
  APPS,
  type AppType 
} from "./config";
import {
  loadProgress,
  deleteProgress,
  allEnvironmentsComplete,
  printProgressSummary,
  type ProgressManifest,
} from "./progress";
import {
  loadLog,
  createFreshLog,
  printLogSummary,
  type InteractionLog,
} from "./logger";

type RunMode = "fresh" | "resume" | "compare-only" | "retry-failed";

const APP_CHOICES: AppType[] = ["admin", "plan", "coach", "auth"];

function promptUser(question: string): string {
  const answer = prompt(question);
  return answer?.trim() ?? "";
}

function selectApp(): AppType {
  console.log("\n📱 Select application to test:\n");
  APP_CHOICES.forEach((app, i) => {
    const config = APPS[app];
    console.log(`  [${i + 1}] ${config.displayName}`);
  });
  console.log("");
  
  const choice = promptUser("Your choice [1]: ");
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
  console.log("Cleared all screenshots, progress, and logs.\n");
}

function determineRunMode(existing: ProgressManifest | null, existingLog: InteractionLog | null): RunMode {
  if (!existing) {
    console.log("No previous progress found. Starting fresh capture.\n");
    return "fresh";
  }

  printProgressSummary(existing);
  
  // Show log summary if exists
  if (existingLog && existingLog.summary.total > 0) {
    printLogSummary(existingLog);
  }

  if (allEnvironmentsComplete(existing)) {
    console.log("All environments were fully captured in a previous run.");
    console.log("  [1] Compare only (skip capture)");
    console.log("  [2] Restart fresh (delete all and recapture)");
    if (existingLog && existingLog.summary.failed > 0) {
      console.log("  [3] Retry failed interactions only");
    }
    const choice = promptUser("\nYour choice [1]: ");
    if (choice === "2") return "fresh";
    if (choice === "3" && existingLog?.summary.failed) return "retry-failed";
    return "compare-only";
  }

  // Partial progress
  console.log("Previous run was interrupted. What would you like to do?");
  console.log("  [1] Resume (continue where it left off)");
  console.log("  [2] Restart fresh (delete all and recapture)");
  console.log("  [3] Compare only (use whatever screenshots exist)");
  if (existingLog && existingLog.summary.failed > 0) {
    console.log("  [4] Retry failed interactions only");
  }
  const choice = promptUser("\nYour choice [1]: ");
  if (choice === "2") return "fresh";
  if (choice === "3") return "compare-only";
  if (choice === "4" && existingLog?.summary.failed) return "retry-failed";
  return "resume";
}

async function runFresh(): Promise<{ pages: string[]; log: InteractionLog }> {
  deleteAllScreenshots();
  console.log("Step 1: Capturing screenshots...");
  const { pages, log } = await captureAll();
  return { pages, log };
}

async function runResume(manifest: ProgressManifest, log: InteractionLog | null): Promise<{ pages: string[]; log: InteractionLog }> {
  console.log("Step 1: Resuming screenshot capture...");
  const result = await captureAll(manifest, log ?? undefined);
  return { pages: result.pages, log: result.log };
}

async function runRetryFailed(manifest: ProgressManifest, existingLog: InteractionLog): Promise<{ pages: string[]; log: InteractionLog }> {
  console.log("Step 1: Retrying failed interactions...");
  // Use existing log to skip already successful ones
  const result = await captureAll(manifest, existingLog);
  return { pages: result.pages, log: result.log };
}

function runCompareOnly(manifest: ProgressManifest | null): { pages: string[]; log: InteractionLog | null } {
  console.log("Step 1: Skipping capture (compare-only mode).");
  if (manifest && manifest.discoveredPages.length > 0) {
    return { pages: manifest.discoveredPages, log: null };
  }
  // Fallback: discover pages from files on disk
  const pages = discoverPagesFromDisk();
  if (pages.length === 0) {
    console.error("No screenshots found on disk. Cannot compare.");
    process.exit(1);
  }
  console.log(`  Found ${pages.length} pages from existing screenshots.`);
  return { pages, log: null };
}

async function main() {
  console.log("=== Cariloop UI Police ===\n");

  // Step 0: Select app
  const selectedApp = selectApp();
  setCurrentApp(selectedApp);
  const appConfig = getCurrentAppConfig();
  console.log(`\n🎯 Selected: ${appConfig.displayName}\n`);
  console.log(`   Screenshots: ${getScreenshotsDir()}/`);
  console.log(`   Path prefix: ${appConfig.pathPrefix || "(root)"}\n`);

  const existing = loadProgress();
  const existingLog = loadLog();
  const mode = determineRunMode(existing, existingLog.summary.total > 0 ? existingLog : null);

  let pages: string[];
  let log: InteractionLog | null = null;

  switch (mode) {
    case "fresh":
      const freshResult = await runFresh();
      pages = freshResult.pages;
      log = freshResult.log;
      break;
    case "resume":
      const resumeResult = await runResume(existing!, existingLog.summary.total > 0 ? existingLog : null);
      pages = resumeResult.pages;
      log = resumeResult.log;
      break;
    case "retry-failed":
      const retryResult = await runRetryFailed(existing!, existingLog);
      pages = retryResult.pages;
      log = retryResult.log;
      break;
    case "compare-only":
      const compareResult = runCompareOnly(existing);
      pages = compareResult.pages;
      log = compareResult.log;
      break;
  }

  // Step 2: Compare screenshots
  console.log("\nStep 2: Comparing screenshots...");
  const results = compareScreenshots(pages);

  // Step 3: Generate HTML report
  console.log("\nStep 3: Generating report...");
  const reportPath = generateReport(results);

  console.log(`\n=== Done! ===`);
  console.log(`Pages compared: ${results.length}`);
  console.log(`Report: ${reportPath}`);

  const avgDiff =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.diffPercentage, 0) / results.length
      : 0;
  console.log(`Average difference: ${avgDiff.toFixed(2)}%`);
  
  // Show interaction summary
  if (log) {
    console.log(`\nInteractions: ✅ ${log.summary.success} success, ❌ ${log.summary.failed} failed`);
    if (log.summary.failed > 0) {
      console.log(`See: ${getScreenshotsDir()}/failure-report.md for details`);
    }
  }
}

main().catch(console.error);
