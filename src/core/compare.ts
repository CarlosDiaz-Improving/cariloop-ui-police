import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { environments, getScreenshotsDir } from "./config";
import { log, style, symbols } from "../utils/terminal";
import { parseFilename } from "../utils/paths";

export interface ComparisonResult {
  pagePath: string;
  filename: string;
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  devScreenshot: string;
  localScreenshot: string;
  diffScreenshot: string;
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
  // Fill with white background
  resized.data.fill(255);
  // Copy existing pixels
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

export function compareScreenshots(pages: string[]): ComparisonResult[] {
  const screenshotsDir = getScreenshotsDir();
  // Use actual environment names from config (e.g. "develop", "local")
  const [env1, env2] = environments;
  const devDir = path.join(screenshotsDir, env1!.name);
  const localDir = path.join(screenshotsDir, env2!.name);
  const diffDir = path.join(screenshotsDir, "diff");

  if (!fs.existsSync(diffDir)) fs.mkdirSync(diffDir, { recursive: true });

  const results: ComparisonResult[] = [];

  // Get all screenshot files from dev directory (includes interactions)
  const allDevFiles = fs.existsSync(devDir)
    ? fs.readdirSync(devDir).filter((f) => f.endsWith(".png"))
    : [];

  // Build set of files to compare
  const filesToCompare = new Set<string>();
  
  // Add base page screenshots
  for (const pagePath of pages) {
    const filename = pagePath.replace(/^\//, "").replace(/\//g, "-") + ".png";
    filesToCompare.add(filename);
  }
  
  // Add all interaction screenshots (files with __ in the name)
  for (const file of allDevFiles) {
    if (file.includes("__")) {
      filesToCompare.add(file);
    }
  }

  log.header("Comparing Screenshots");
  console.log(`  ${style.muted(`Files to compare: ${filesToCompare.size}`)}\n`);

  for (const filename of filesToCompare) {
    const devPath = path.join(devDir, filename);
    const localPath = path.join(localDir, filename);
    const diffPath = path.join(diffDir, filename);

    if (!fs.existsSync(devPath) || !fs.existsSync(localPath)) {
      // Only log for base pages, not for interactions that might not exist
      if (!filename.includes("__")) {
        log.warning(`Skipping ${filename}: missing screenshot(s)`);
      }
      continue;
    }

    // Parse pagePath and interactionId from filename
    const parsed = parseFilename(filename);
    const { pagePath, interactionId } = parsed;
    
    if (interactionId) {
      console.log(`  ${symbols.tee} ${style.path(pagePath)} ${style.muted(`[${interactionId}]`)}`);
    } else {
      console.log(`  ${symbols.tee} ${style.path(pagePath)}`);
    }

    let devImg = readPng(devPath);
    let localImg = readPng(localPath);

    // Resize to the larger dimensions if they differ
    const maxWidth = Math.max(devImg.width, localImg.width);
    const maxHeight = Math.max(devImg.height, localImg.height);
    devImg = resizeToMatch(devImg, maxWidth, maxHeight);
    localImg = resizeToMatch(localImg, maxWidth, maxHeight);

    const diff = new PNG({ width: maxWidth, height: maxHeight });
    const diffPixels = pixelmatch(
      devImg.data,
      localImg.data,
      diff.data,
      maxWidth,
      maxHeight,
      {
        threshold: 0.1,
        diffColor: [255, 0, 0],
      }
    );

    const totalPixels = maxWidth * maxHeight;
    const diffPercentage = (diffPixels / totalPixels) * 100;

    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    results.push({
      pagePath,
      filename,
      diffPixels,
      totalPixels,
      diffPercentage,
      devScreenshot: devPath,
      localScreenshot: localPath,
      diffScreenshot: diffPath,
      interactionId,
      description: interactionId ? `Interaction: ${interactionId}` : undefined,
    });

    const diffStyleFn = getDiffStyle(diffPercentage);
    console.log(`    ${diffStyleFn(`${diffPercentage.toFixed(2)}%`)} ${style.muted(`(${diffPixels}/${totalPixels} px)`)}`);
  }

  return results;
}

// Allow running standalone
if (import.meta.main) {
  // Discover pages from existing dev screenshots
  const [env1] = environments;
  const devDir = path.join(getScreenshotsDir(), env1!.name);
  if (!fs.existsSync(devDir)) {
    log.error(`No ${env1!.name} screenshots found. Run capture first.`);
    process.exit(1);
  }
  const files = fs.readdirSync(devDir).filter((f) => f.endsWith(".png"));
  const pages = files
    .filter((f) => !f.includes("__"))
    .map((f) => "/" + f.replace(".png", "").replace(/-/g, "/"));

  const results = compareScreenshots(pages);
  log.success(`Compared ${results.length} items.`);
}
