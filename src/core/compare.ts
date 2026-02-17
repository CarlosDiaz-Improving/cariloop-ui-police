import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { environments, getCurrentApp } from "./config";
import {
  getRunDir,
  getDiffPairDir,
  getLatestCompletedRun,
  loadRunManifest,
} from "./runs";
import { log, style, symbols } from "../utils/terminal";
import { parseFilename, pageSlug } from "../utils/paths";

export interface ComparisonResult {
  pagePath: string;
  filename: string;
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  /** Path to the first source screenshot */
  env1Screenshot: string;
  /** Path to the second source screenshot */
  env2Screenshot: string;
  diffScreenshot: string;
  /** Labels for display */
  env1Label: string;
  env2Label: string;
  /** If this is an interaction, the interaction ID */
  interactionId?: string;
  /** Human-readable description for interactions */
  description?: string;
}

function readPng(filepath: string): PNG {
  const buffer = fs.readFileSync(filepath);
  return PNG.sync.read(buffer);
}

function resizeToMatch(img: PNG, targetWidth: number, targetHeight: number): PNG {
  if (img.width === targetWidth && img.height === targetHeight) return img;

  const resized = new PNG({ width: targetWidth, height: targetHeight });
  resized.data.fill(255);
  for (let y = 0; y < Math.min(img.height, targetHeight); y++) {
    for (let x = 0; x < Math.min(img.width, targetWidth); x++) {
      const srcIdx = (y * img.width + x) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      resized.data[dstIdx] = img.data[srcIdx]!;
      resized.data[dstIdx + 1] = img.data[srcIdx + 1]!;
      resized.data[dstIdx + 2] = img.data[srcIdx + 2]!;
      resized.data[dstIdx + 3] = img.data[srcIdx + 3]!;
    }
  }
  return resized;
}

function getDiffStyle(pct: number): (text: string) => string {
  if (pct < 1) return style.success;
  if (pct < 5) return style.warning;
  return style.error;
}

function listPngs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".png"));
}

/**
 * Core comparison engine — compares two directories of screenshots,
 * writing diff images to the specified output directory.
 */
function compareDirs(
  dir1: string,
  dir2: string,
  diffDir: string,
  label1: string,
  label2: string,
): ComparisonResult[] {
  if (!fs.existsSync(diffDir)) fs.mkdirSync(diffDir, { recursive: true });

  const files1 = listPngs(dir1);
  const files2 = listPngs(dir2);

  // Build slug → filename maps (filenames are identical slug.png in both dirs)
  const set1 = new Set(files1);
  const set2 = new Set(files2);
  const allFiles = new Set([...files1, ...files2]);

  const results: ComparisonResult[] = [];

  log.header(`Comparing: ${label1} vs ${label2}`);
  console.log(`  ${style.muted(`Files to compare: ${allFiles.size}`)}\n`);

  for (const filename of [...allFiles].sort()) {
    if (!set1.has(filename) || !set2.has(filename)) {
      if (!filename.includes("__")) {
        const missing = !set1.has(filename) ? label1 : label2;
        log.warning(`Skipping ${filename}: missing in ${missing}`);
      }
      continue;
    }

    const path1 = path.join(dir1, filename);
    const path2 = path.join(dir2, filename);
    if (!fs.existsSync(path1) || !fs.existsSync(path2)) continue;

    const parsed = parseFilename(filename);
    const { pagePath, interactionId } = parsed;

    if (interactionId) {
      console.log(`  ${symbols.tee} ${style.path(pagePath)} ${style.muted(`[${interactionId}]`)}`);
    } else {
      console.log(`  ${symbols.tee} ${style.path(pagePath)}`);
    }

    let img1 = readPng(path1);
    let img2 = readPng(path2);

    const maxWidth = Math.max(img1.width, img2.width);
    const maxHeight = Math.max(img1.height, img2.height);
    img1 = resizeToMatch(img1, maxWidth, maxHeight);
    img2 = resizeToMatch(img2, maxWidth, maxHeight);

    const diff = new PNG({ width: maxWidth, height: maxHeight });
    const diffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      maxWidth,
      maxHeight,
      { threshold: 0.1, diffColor: [255, 0, 0] }
    );

    const totalPixels = maxWidth * maxHeight;
    const diffPercentage = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(diffDir, filename);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    results.push({
      pagePath,
      filename,
      diffPixels,
      totalPixels,
      diffPercentage,
      env1Screenshot: path1,
      env2Screenshot: path2,
      diffScreenshot: diffPath,
      env1Label: label1,
      env2Label: label2,
      interactionId,
      description: interactionId ? `Interaction: ${interactionId}` : undefined,
    });

    const diffStyleFn = getDiffStyle(diffPercentage);
    console.log(`    ${diffStyleFn(`${diffPercentage.toFixed(2)}%`)} ${style.muted(`(${diffPixels}/${totalPixels} px)`)}`);
  }

  return results;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Cross-environment comparison using the latest completed run of each env.
 * e.g., captures/auth/develop/260217-001/ vs captures/auth/local/260217-001/
 * Diffs go to captures/auth/diffs/develop-vs-local/
 */
export function compareCrossEnv(
  app: string,
  env1: string,
  env1RunId: string,
  env2: string,
  env2RunId: string,
): ComparisonResult[] {
  const dir1 = getRunDir(app, env1, env1RunId);
  const dir2 = getRunDir(app, env2, env2RunId);
  const diffLabel = `${env1}-vs-${env2}`;
  const diffDir = getDiffPairDir(app, diffLabel);

  return compareDirs(dir1, dir2, diffDir, `${env1} (${env1RunId})`, `${env2} (${env2RunId})`);
}

/**
 * Cross-run comparison for the same environment.
 * e.g., captures/auth/develop/260217-002/ vs captures/auth/develop/260217-001/
 * Diffs go to captures/auth/diffs/develop-260217-002-vs-001/
 */
export function compareCrossRun(
  app: string,
  env: string,
  currentRunId: string,
  previousRunId: string,
): ComparisonResult[] {
  const dir1 = getRunDir(app, env, currentRunId);
  const dir2 = getRunDir(app, env, previousRunId);
  const diffLabel = `${env}-${currentRunId}-vs-${previousRunId}`;
  const diffDir = getDiffPairDir(app, diffLabel);

  return compareDirs(dir1, dir2, diffDir, `${env} (${currentRunId})`, `${env} (${previousRunId})`);
}

/**
 * Default comparison — latest completed run per env, cross-env diff.
 * This is what the main flow calls.
 */
export function compareScreenshots(pages: string[]): ComparisonResult[] {
  const appName = getCurrentApp();
  const [env1, env2] = environments;
  if (!env1 || !env2) {
    log.error("Need at least 2 environments configured for comparison");
    return [];
  }

  const run1 = getLatestCompletedRun(appName, env1.name);
  const run2 = getLatestCompletedRun(appName, env2.name);

  if (!run1 || !run2) {
    const missing = !run1 ? env1.name : env2.name;
    log.error(`No completed runs found for ${appName}/${missing}. Run capture first.`);
    return [];
  }

  return compareCrossEnv(appName, env1.name, run1.runId, env2.name, run2.runId);
}

// Allow running standalone
if (import.meta.main) {
  const results = compareScreenshots([]);
  log.success(`Compared ${results.length} items.`);
}
