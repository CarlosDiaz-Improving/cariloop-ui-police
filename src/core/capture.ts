import { chromium, type Page } from "playwright";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import {
  environments,
  getViewport,
  getScreenshotsDir,
  getCurrentAppConfig,
  timeouts,
  type EnvConfig,
} from "./config";
import { login } from "./auth";
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
import { log, style, symbols } from "../utils/terminal";
import { pathToFilename, interactionFilename } from "../utils/paths";

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
  interactionLog: InteractionLog
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
    if (hasSucceeded(interactionLog, envName, pagePath, interaction.id)) {
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
        logInteraction(interactionLog, {
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

    log.interaction(interaction.description);
    
    const result = await executeInteraction(page, interaction, pagePath);
    
    if (result.success) {
      try {
        await page.screenshot({ path: filepath, fullPage: true });
        markInteractionCaptured(manifest, envName, pagePath, interaction.id);
        log.fileSaved(filename);
        
        logInteraction(interactionLog, {
          environment: envName,
          pagePath,
          interactionId: interaction.id,
          description: interaction.description,
          status: "success",
          screenshotPath: filepath,
          duration: Date.now() - startTime,
        });
      } catch (err) {
        console.log(`      ${style.error(`${symbols.cross} Screenshot failed:`)} ${err}`);
        logInteraction(interactionLog, {
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
        console.log(`      ${style.error(`${symbols.cross} Failed:`)} ${result.error?.substring(0, 80)}...`);
        logInteraction(interactionLog, {
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
  interactionLog: InteractionLog,
  captureInteractionsEnabled: boolean = true
): Promise<void> {
  for (const pagePath of pages) {
    const alreadyCaptured = isPageCaptured(manifest, envName, pagePath);
    
    if (!alreadyCaptured) {
      const url = `${baseUrl}${pagePath}`;
      const filename = pathToFilename(pagePath);
      const filepath = path.join(outputDir, filename);
      const appConfig = getCurrentAppConfig();

      log.page(pagePath, pages.indexOf(pagePath) + 1, pages.length);
      
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
        log.fileSaved(filename);
      } catch (err) {
        console.log(`    ${style.error(`${symbols.cross} Failed to capture:`)} ${err}`);
        continue; // Skip interactions if base page failed
      }
    } else {
      console.log(`  ${style.muted(`${symbols.arrow} Skipping ${pagePath} (already captured)`)}`);
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
      await captureInteractions(page, pagePath, baseUrl, outputDir, manifest, envName, interactionLog);
    }
    
    // Add separator line between pages
    console.log("");
  }
}

export async function captureEnvironment(
  env: EnvConfig,
  manifest: ProgressManifest,
  interactionLog: InteractionLog
): Promise<{ pages: string[]; outputDir: string }> {
  const outputDir = path.join(getScreenshotsDir(), env.name);

  if (isEnvironmentComplete(manifest, env.name)) {
    log.warning(`Skipping environment: ${env.name} (already complete)`);
    return { pages: manifest.discoveredPages, outputDir };
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  log.header(`Capturing: ${env.name}`);
  console.log(`  ${style.url(env.baseUrl)}\n`);

  const viewport = getViewport();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    await login(page, env.baseUrl, env.name);

    // Reuse already-discovered pages, or discover fresh
    let pages: string[];
    if (manifest.discoveredPages.length > 0) {
      pages = manifest.discoveredPages;
      log.step(`Using ${style.count(pages.length.toString())} previously discovered pages`);
    } else {
      pages = await discoverPages(page);
      manifest.discoveredPages = pages;
      saveProgress(manifest);
    }

    await capturePages(page, pages, env.baseUrl, outputDir, manifest, env.name, interactionLog);
    markEnvironmentComplete(manifest, env.name);
    return { pages, outputDir };
  } finally {
    await browser.close();
  }
}

export async function captureAll(
  manifest?: ProgressManifest,
  interactionLog?: InteractionLog
): Promise<{ pages: string[]; manifest: ProgressManifest; log: InteractionLog }> {
  const m = manifest ?? createFreshManifest();
  const l = interactionLog ?? createFreshLog();
  let discoveredPages: string[] = m.discoveredPages;

  for (const env of environments) {
    try {
      const result = await captureEnvironment(env, m, l);
      if (discoveredPages.length === 0) {
        discoveredPages = result.pages;
      }
    } catch (err) {
      log.error(`Failed to capture environment ${env.name}: ${err}`);
      console.log("  Continuing to next environment...\n");
    }
  }

  // Print log summary at the end
  printLogSummary(l);
  
  // Save failure report if there are failures
  if (l.summary.failed > 0) {
    const reportPath = saveFailureReport(l);
    log.fileSaved(reportPath, "Failure report");
  }

  return { pages: discoveredPages, manifest: m, log: l };
}

// Allow running standalone
if (import.meta.main) {
  captureAll()
    .then(({ pages, log: l }) => {
      log.success(`Done! Captured ${pages.length} pages from each environment.`);
      console.log(`  ${style.info("Interactions:")} ${l.summary.success} success, ${l.summary.failed} failed`);
    })
    .catch(console.error);
}
