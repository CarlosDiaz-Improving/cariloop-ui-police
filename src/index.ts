import fs from "fs";
import path from "path";
import { captureAll } from "./capture";
import { compareScreenshots } from "./compare";
import { generateReport } from "./report";
import { screenshotsDir } from "./config";
import {
  loadProgress,
  deleteProgress,
  allEnvironmentsComplete,
  printProgressSummary,
  type ProgressManifest,
} from "./progress";

type RunMode = "fresh" | "resume" | "compare-only";

function discoverPagesFromDisk(): string[] {
  const devDir = path.join(screenshotsDir, "dev");
  if (!fs.existsSync(devDir)) return [];
  const files = fs.readdirSync(devDir).filter((f) => f.endsWith(".png"));
  return files.map((f) => "/" + f.replace(".png", "").replace(/-/g, "/"));
}

function deleteAllScreenshots(): void {
  const dirs = ["dev", "local", "diff"].map((d) => path.join(screenshotsDir, d));
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  }
  deleteProgress();
  console.log("Cleared all screenshots and progress.\n");
}

function promptUser(question: string): string {
  const answer = prompt(question);
  return answer?.trim() ?? "";
}

function determineRunMode(existing: ProgressManifest | null): RunMode {
  if (!existing) {
    console.log("No previous progress found. Starting fresh capture.\n");
    return "fresh";
  }

  printProgressSummary(existing);

  if (allEnvironmentsComplete(existing)) {
    console.log("All environments were fully captured in a previous run.");
    console.log("  [1] Compare only (skip capture)");
    console.log("  [2] Restart fresh (delete all and recapture)");
    const choice = promptUser("\nYour choice [1]: ");
    if (choice === "2") return "fresh";
    return "compare-only";
  }

  // Partial progress
  console.log("Previous run was interrupted. What would you like to do?");
  console.log("  [1] Resume (continue where it left off)");
  console.log("  [2] Restart fresh (delete all and recapture)");
  console.log("  [3] Compare only (use whatever screenshots exist)");
  const choice = promptUser("\nYour choice [1]: ");
  if (choice === "2") return "fresh";
  if (choice === "3") return "compare-only";
  return "resume";
}

async function runFresh(): Promise<string[]> {
  deleteAllScreenshots();
  console.log("Step 1: Capturing screenshots...");
  const { pages } = await captureAll();
  return pages;
}

async function runResume(manifest: ProgressManifest): Promise<string[]> {
  console.log("Step 1: Resuming screenshot capture...");
  const { pages } = await captureAll(manifest);
  return pages;
}

function runCompareOnly(manifest: ProgressManifest | null): string[] {
  console.log("Step 1: Skipping capture (compare-only mode).");
  if (manifest && manifest.discoveredPages.length > 0) {
    return manifest.discoveredPages;
  }
  // Fallback: discover pages from files on disk
  const pages = discoverPagesFromDisk();
  if (pages.length === 0) {
    console.error("No screenshots found on disk. Cannot compare.");
    process.exit(1);
  }
  console.log(`  Found ${pages.length} pages from existing screenshots.`);
  return pages;
}

async function main() {
  console.log("=== Cariloop UI Police ===\n");

  const existing = loadProgress();
  const mode = determineRunMode(existing);

  let pages: string[];

  switch (mode) {
    case "fresh":
      pages = await runFresh();
      break;
    case "resume":
      pages = await runResume(existing!);
      break;
    case "compare-only":
      pages = runCompareOnly(existing);
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
}

main().catch(console.error);
