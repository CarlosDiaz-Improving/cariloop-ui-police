import { chromium, type Page } from "playwright";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import {
  environments,
  getViewport,
  getViewportString,
  getCurrentApp,
  getCurrentAppConfig,
  captureOptions,
  timeouts,
  projectConfig,
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
import {
  getOrCreateRun,
  completeRun,
  registerScreenshot,
  nextScreenshotId,
  getRunDir,
} from "./runs";
import { log, style, symbols } from "../utils/terminal";
import { pathToFilename, interactionFilename } from "../utils/paths";
import { captureRegistrationFlow, getRegistrationMode, getAvailableTestUsers } from "../apps/auth/registration-flow";

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
  appName: string,
  runId: string,
  interactionLog: InteractionLog
): Promise<void> {
  const interactions = getAllInteractions();
  
  for (const interaction of interactions) {
    if (!shouldRunOnPage(interaction, pagePath)) continue;
    if (isInteractionCaptured(manifest, envName, pagePath, interaction.id)) continue;
    if (hasSucceeded(interactionLog, envName, pagePath, interaction.id)) continue;

    const filename = interactionFilename(pagePath, interaction.id);
    const filepath = path.join(outputDir, filename);
    const startTime = Date.now();

    // Ensure we're on the correct page
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
          environment: envName, pagePath,
          interactionId: interaction.id, description: interaction.description,
          status: "skipped", error: "Could not navigate to page",
          duration: Date.now() - startTime,
        });
        continue;
      }
    }

    log.interaction(interaction.description);
    const result = await executeInteraction(page, interaction, pagePath);
    
    if (result.success) {
      try {
        await page.screenshot({ path: filepath, fullPage: captureOptions.fullPage });
        markInteractionCaptured(manifest, envName, pagePath, interaction.id);
        log.fileSaved(filename);

        registerScreenshot(appName, runId, envName, {
          id: nextScreenshotId(appName, runId, envName),
          page: pagePath,
          file: filename,
          viewport: getViewportString(),
          interactionId: interaction.id,
          description: interaction.description,
        });
        
        logInteraction(interactionLog, {
          environment: envName, pagePath,
          interactionId: interaction.id, description: interaction.description,
          status: "success", screenshotPath: filepath,
          duration: Date.now() - startTime,
        });
      } catch (err) {
        console.log(`      ${style.error(`${symbols.cross} Screenshot failed:`)} ${err}`);
        logInteraction(interactionLog, {
          environment: envName, pagePath,
          interactionId: interaction.id, description: interaction.description,
          status: "failed", error: `Screenshot failed: ${err}`,
          duration: Date.now() - startTime,
        });
      }
      await closeInteraction(page, interaction);
    } else {
      if (result.error?.includes("Element not found") || result.error?.includes("Element not visible")) {
        // Silent skip
      } else {
        console.log(`      ${style.error(`${symbols.cross} Failed:`)} ${result.error?.substring(0, 80)}...`);
        logInteraction(interactionLog, {
          environment: envName, pagePath,
          interactionId: interaction.id, description: interaction.description,
          status: "failed", error: result.error,
          duration: Date.now() - startTime,
        });
      }
    }
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
  appName: string,
  runId: string,
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

      // For auth app: set introductionSeen so /register shows the form
      if (!appConfig.requiresAuth && pagePath === "/register") {
        await page.evaluate(() => localStorage.setItem("cariloop:introductionSeen", "true"));
      }

      log.page(pagePath, pages.indexOf(pagePath) + 1, pages.length);
      
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: timeouts.pageNavigation,
        });
        try {
          await page.waitForSelector(appConfig.readySelector, {
            timeout: timeouts.contentReady,
          });
        } catch {
          // Content may still be loading, take screenshot anyway
        }
        await page.waitForTimeout(timeouts.settleDelay);
        await page.screenshot({ path: filepath, fullPage: captureOptions.fullPage });
        markPageCaptured(manifest, envName, pagePath);
        log.fileSaved(filename);

        registerScreenshot(appName, runId, envName, {
          id: nextScreenshotId(appName, runId, envName),
          page: pagePath,
          file: filename,
          viewport: getViewportString(),
        });
      } catch (err) {
        console.log(`    ${style.error(`${symbols.cross} Failed to capture:`)} ${err}`);
        continue;
      }
    } else {
      console.log(`  ${style.muted(`${symbols.arrow} Skipping ${pagePath} (already captured)`)}`);
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

    if (captureInteractionsEnabled) {
      await captureInteractions(page, pagePath, baseUrl, outputDir, manifest, envName, appName, runId, interactionLog);
    }
    console.log("");
  }
}

/**
 * Capture a single environment — gets or resumes a run, then captures pages.
 * Returns { pages, runId }.
 */
async function captureEnvironment(
  env: EnvConfig,
  appName: string,
  manifest: ProgressManifest,
  interactionLog: InteractionLog,
): Promise<{ pages: string[]; runId: string }> {
  const appConfig = getCurrentAppConfig();

  // Get or resume a run for this app+env
  const run = getOrCreateRun(appName, env.name, env.baseUrl, projectConfig.version);
  const outputDir = getRunDir(appName, env.name, run.runId);

  if (run.resumed) {
    log.header(`Resuming run ${run.runId} — ${env.name}`);
  } else {
    log.header(`New run ${run.runId} — ${env.name}`);
  }
  console.log(`  ${style.url(env.baseUrl)}\n`);

  if (isEnvironmentComplete(manifest, env.name)) {
    log.warning(`Skipping environment: ${env.name} (already complete)`);
    completeRun(appName, env.name, run.runId, run.startTime, "completed");
    return { pages: manifest.discoveredPages, runId: run.runId };
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const viewport = getViewport();
  const headless = captureOptions.headless ?? true;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    if (!appConfig.requiresAuth) {
      log.action("Skipping login (public pages)");
      await page.goto(env.baseUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeouts.loginNavigation,
      });
      try {
        await page.waitForSelector(appConfig.readySelector, {
          timeout: timeouts.contentReady,
        });
      } catch {
        // Page may not have the ready selector, continue anyway
      }
    } else {
      await login(page, env.baseUrl, env.name);
    }

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

    await capturePages(page, pages, env.baseUrl, outputDir, manifest, env.name, appName, run.runId, interactionLog);

    // Run registration flow for auth app if enabled
    if (!appConfig.requiresAuth && appConfig.name === "auth") {
      const regMode = getRegistrationMode();
      if (regMode !== "disabled") {
        const poolInfo = getAvailableTestUsers();
        if (regMode === "full-flow") {
          console.log(`  ${style.info(`Test user pool: ${poolInfo.available}/${poolInfo.total} available`)}\n`);
        }
        try {
          await captureRegistrationFlow(page, env.baseUrl, outputDir);
        } catch (err) {
          log.error(`Registration flow failed: ${err}`);
        }
      }
    }

    markEnvironmentComplete(manifest, env.name);
    completeRun(appName, env.name, run.runId, run.startTime, "completed");
    return { pages, runId: run.runId };
  } catch (err) {
    completeRun(appName, env.name, run.runId, run.startTime, "failed");
    throw err;
  } finally {
    await browser.close();
  }
}

/**
 * Main entry point — captures each environment with its own run.
 * Incomplete runs are automatically resumed instead of duplicated.
 */
export async function captureAll(
  manifest?: ProgressManifest,
  interactionLog?: InteractionLog
): Promise<{ pages: string[]; manifest: ProgressManifest; log: InteractionLog; runIds: Record<string, string> }> {
  const m = manifest ?? createFreshManifest();
  const l = interactionLog ?? createFreshLog();
  const appName = getCurrentApp();
  let discoveredPages: string[] = m.discoveredPages;
  const runIds: Record<string, string> = {};

  const envNames = environments.map((e) => e.name);
  log.header(`Capturing ${appName}`);
  console.log(`  ${style.muted(`Environments: ${envNames.join(", ")}`)}\n`);

  for (const env of environments) {
    try {
      const result = await captureEnvironment(env, appName, m, l);
      runIds[env.name] = result.runId;
      if (discoveredPages.length === 0) {
        discoveredPages = result.pages;
      }
    } catch (err) {
      log.error(`Failed to capture environment ${env.name}: ${err}`);
      console.log("  Continuing to next environment...\n");
    }
  }

  printLogSummary(l);
  if (l.summary.failed > 0) {
    const reportPath = saveFailureReport(l);
    log.fileSaved(reportPath, "Failure report");
  }

  return { pages: discoveredPages, manifest: m, log: l, runIds };
}

// Allow running standalone
if (import.meta.main) {
  captureAll()
    .then(({ pages, log: l, runIds }) => {
      const ids = Object.entries(runIds).map(([e, id]) => `${e}:${id}`).join(", ");
      log.success(`Done! ${pages.length} pages captured. Runs: ${ids}`);
      console.log(`  ${style.info("Interactions:")} ${l.summary.success} success, ${l.summary.failed} failed`);
    })
    .catch(console.error);
}
