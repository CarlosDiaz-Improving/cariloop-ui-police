import { chromium, type Page } from "playwright";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import {
  environments,
  viewport,
  getScreenshotsDir,
  getCurrentAppConfig,
  timeouts,
  type EnvConfig,
} from "./config";
import { login, logout, needsLogoutBeforeSwitch } from "./auth";
import { discoverPages } from "./discover";
import type { ProgressManifest } from "./progress";
import {
  isPageCaptured,
  markPageCaptured,
  markEnvironmentComplete,
  isEnvironmentComplete,
  createFreshManifest,
  saveProgress,
  isInteractionCaptured,
  markInteractionCaptured,
} from "./progress";
import {
  getAllInteractions,
  executeInteraction,
  closeInteraction,
  shouldRunOnPage,
  closeAllOverlays,
  type Interaction,
} from "./interactions";
import {
  type InteractionLog,
  loadLog,
  createFreshLog,
  logInteraction,
  printLogSummary,
  saveFailureReport,
  hasSucceeded,
} from "./logger";

function pathToFilename(pagePath: string): string {
  return pagePath.replace(/^\//, "").replace(/\//g, "-") + ".png";
}

function interactionFilename(pagePath: string, interactionId: string): string {
  const base = pagePath.replace(/^\//, "").replace(/\//g, "-");
  return `${base}__${interactionId}.png`;
}

/**
 * Capture interactions on the current page (menus, buttons, hover states)
 */
async function captureInteractions(
  page: Page,
  pagePath: string,
  baseUrl: string,
  outputDir: string,
  manifest: ProgressManifest,
  envName: string,
  log: InteractionLog
): Promise<void> {
  const interactions = getAllInteractions();
  
  for (const interaction of interactions) {
    // Check if interaction applies to this page
    if (!shouldRunOnPage(interaction, pagePath)) {
      continue;
    }

    // Check if already captured successfully
    if (isInteractionCaptured(manifest, envName, pagePath, interaction.id)) {
      continue;
    }
    
    // Check if already succeeded in log (for retry runs)
    if (hasSucceeded(log, envName, pagePath, interaction.id)) {
      continue;
    }

    const filename = interactionFilename(pagePath, interaction.id);
    const filepath = path.join(outputDir, filename);
    const startTime = Date.now();

    // Ensure we're on the correct page (interactions might have navigated away)
    const currentUrl = page.url();
    const expectedUrl = `${baseUrl}${pagePath}`;
    const expectedBase = expectedUrl.split("?")[0] ?? expectedUrl;
    if (!currentUrl.startsWith(expectedBase)) {
      try {
        await page.goto(expectedUrl, {
          waitUntil: "domcontentloaded",
          timeout: timeouts.pageNavigation,
        });
        await page.waitForTimeout(timeouts.settleDelay);
      } catch {
        logInteraction(log, {
          environment: envName,
          pagePath,
          interactionId: interaction.id,
          description: interaction.description,
          status: "skipped",
          error: "Could not navigate to page",
          duration: Date.now() - startTime,
        });
        continue;
      }
    }

    console.log(`    → Interaction: ${interaction.description}...`);
    
    const result = await executeInteraction(page, interaction, pagePath);
    
    if (result.success) {
      try {
        await page.screenshot({ path: filepath, fullPage: true });
        markInteractionCaptured(manifest, envName, pagePath, interaction.id);
        console.log(`      ✅ Saved: ${filename}`);
        
        logInteraction(log, {
          environment: envName,
          pagePath,
          interactionId: interaction.id,
          description: interaction.description,
          status: "success",
          screenshotPath: filepath,
          duration: Date.now() - startTime,
        });
      } catch (err) {
        console.error(`      ❌ Screenshot failed: ${err}`);
        logInteraction(log, {
          environment: envName,
          pagePath,
          interactionId: interaction.id,
          description: interaction.description,
          status: "failed",
          error: `Screenshot failed: ${err}`,
          duration: Date.now() - startTime,
        });
      }
      
      // Close/reset the interaction state
      await closeInteraction(page, interaction);
    } else {
      // Element not found is normal - just skip without logging as failure
      if (result.error?.includes("Element not found") || result.error?.includes("Element not visible")) {
        // Silent skip - element doesn't exist on this page
      } else {
        console.log(`      ❌ Failed: ${result.error?.substring(0, 80)}...`);
        logInteraction(log, {
          environment: envName,
          pagePath,
          interactionId: interaction.id,
          description: interaction.description,
          status: "failed",
          error: result.error,
          duration: Date.now() - startTime,
        });
      }
    }
    
    // Always try to close overlays between interactions
    await closeAllOverlays(page);
  }
}

async function capturePages(
  page: Page,
  pages: string[],
  baseUrl: string,
  outputDir: string,
  manifest: ProgressManifest,
  envName: string,
  log: InteractionLog,
  captureInteractionsEnabled: boolean = true
): Promise<void> {
  for (const pagePath of pages) {
    const alreadyCaptured = isPageCaptured(manifest, envName, pagePath);
    
    if (!alreadyCaptured) {
      const url = `${baseUrl}${pagePath}`;
      const filename = pathToFilename(pagePath);
      const filepath = path.join(outputDir, filename);
      const appConfig = getCurrentAppConfig();

      console.log(`  Capturing ${pagePath}...`);
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: timeouts.pageNavigation,
        });
        // Wait for SPA content to render
        try {
          await page.waitForSelector(appConfig.readySelector, {
            timeout: timeouts.contentReady,
          });
        } catch {
          // Content may still be loading, take screenshot anyway
        }
        await page.waitForTimeout(timeouts.settleDelay);
        await page.screenshot({ path: filepath, fullPage: true });
        markPageCaptured(manifest, envName, pagePath);
        console.log(`    Saved: ${filepath}`);
      } catch (err) {
        console.error(`    Failed to capture ${pagePath}: ${err}`);
        continue; // Skip interactions if base page failed
      }
    } else {
      console.log(`  Skipping ${pagePath} (already captured)`);
      // Still need to navigate to page for interactions
      if (captureInteractionsEnabled) {
        try {
          await page.goto(`${baseUrl}${pagePath}`, {
            waitUntil: "domcontentloaded",
            timeout: timeouts.pageNavigation,
          });
          await page.waitForTimeout(timeouts.settleDelay);
        } catch {
          continue;
        }
      }
    }

    // Capture interaction states (menus, buttons, etc.)
    if (captureInteractionsEnabled) {
      await captureInteractions(page, pagePath, baseUrl, outputDir, manifest, envName, log);
    }
  }
}

export async function captureEnvironment(
  env: EnvConfig,
  manifest: ProgressManifest,
  log: InteractionLog
): Promise<{ pages: string[]; outputDir: string }> {
  const outputDir = path.join(getScreenshotsDir(), env.name);

  if (isEnvironmentComplete(manifest, env.name)) {
    console.log(`\nSkipping environment: ${env.name} (already complete)`);
    return { pages: manifest.discoveredPages, outputDir };
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  console.log(`\nCapturing environment: ${env.name} (${env.baseUrl})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    await login(page, env.baseUrl, env.name);

    // Reuse already-discovered pages, or discover fresh
    let pages: string[];
    if (manifest.discoveredPages.length > 0) {
      pages = manifest.discoveredPages;
      console.log(`  Using ${pages.length} previously discovered pages`);
    } else {
      pages = await discoverPages(page);
      manifest.discoveredPages = pages;
      saveProgress(manifest);
    }

    await capturePages(page, pages, env.baseUrl, outputDir, manifest, env.name, log);
    markEnvironmentComplete(manifest, env.name);
    return { pages, outputDir };
  } finally {
    await browser.close();
  }
}

export async function captureAll(
  manifest?: ProgressManifest,
  log?: InteractionLog
): Promise<{ pages: string[]; manifest: ProgressManifest; log: InteractionLog }> {
  const m = manifest ?? createFreshManifest();
  const l = log ?? createFreshLog();
  let discoveredPages: string[] = m.discoveredPages;

  for (const env of environments) {
    try {
      const result = await captureEnvironment(env, m, l);
      if (discoveredPages.length === 0) {
        discoveredPages = result.pages;
      }
    } catch (err) {
      console.error(`\nFailed to capture environment ${env.name}: ${err}`);
      console.error("Continuing to next environment...\n");
    }
  }

  // Print log summary at the end
  printLogSummary(l);
  
  // Save failure report if there are failures
  if (l.summary.failed > 0) {
    const reportPath = saveFailureReport(l);
    console.log(`Failure report saved: ${reportPath}`);
  }

  return { pages: discoveredPages, manifest: m, log: l };
}

// Allow running standalone
if (import.meta.main) {
  captureAll()
    .then(({ pages, log }) => {
      console.log(`\nDone! Captured ${pages.length} pages from each environment.`);
      console.log(`Interactions: ${log.summary.success} success, ${log.summary.failed} failed`);
    })
    .catch(console.error);
}
