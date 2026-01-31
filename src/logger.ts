import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { getScreenshotsDir } from "./config";

function getLogFile(): string {
  return path.join(getScreenshotsDir(), "interaction-log.json");
}

export type LogStatus = "success" | "failed" | "skipped";

export interface InteractionLogEntry {
  timestamp: string;
  environment: string;
  pagePath: string;
  interactionId: string;
  description: string;
  status: LogStatus;
  error?: string;
  screenshotPath?: string;
  duration?: number;
}

export interface InteractionLog {
  startedAt: string;
  lastUpdated: string;
  summary: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
  entries: InteractionLogEntry[];
}

/**
 * Load existing log or create a new one
 */
export function loadLog(): InteractionLog {
  const logFile = getLogFile();
  if (existsSync(logFile)) {
    try {
      const content = readFileSync(logFile, "utf-8");
      return JSON.parse(content) as InteractionLog;
    } catch {
      // Corrupted log, create new
    }
  }
  return createFreshLog();
}

/**
 * Create a fresh log
 */
export function createFreshLog(): InteractionLog {
  return {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    summary: {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
    },
    entries: [],
  };
}

/**
 * Save log to disk
 */
export function saveLog(log: InteractionLog): void {
  const logFile = getLogFile();
  const dir = path.dirname(logFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  log.lastUpdated = new Date().toISOString();
  writeFileSync(logFile, JSON.stringify(log, null, 2), "utf-8");
}

/**
 * Add an entry to the log
 */
export function logInteraction(
  log: InteractionLog,
  entry: Omit<InteractionLogEntry, "timestamp">
): void {
  const fullEntry: InteractionLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  
  log.entries.push(fullEntry);
  log.summary.total++;
  
  if (entry.status === "success") {
    log.summary.success++;
  } else if (entry.status === "failed") {
    log.summary.failed++;
  } else {
    log.summary.skipped++;
  }
  
  saveLog(log);
}

/**
 * Get all failed interactions
 */
export function getFailedInteractions(log: InteractionLog): InteractionLogEntry[] {
  return log.entries.filter((e) => e.status === "failed");
}

/**
 * Get failed interactions grouped by page
 */
export function getFailedByPage(log: InteractionLog): Map<string, InteractionLogEntry[]> {
  const failed = getFailedInteractions(log);
  const grouped = new Map<string, InteractionLogEntry[]>();
  
  for (const entry of failed) {
    const key = `${entry.environment}:${entry.pagePath}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }
  
  return grouped;
}

/**
 * Check if a specific interaction already succeeded (to skip on retry)
 */
export function hasSucceeded(
  log: InteractionLog,
  environment: string,
  pagePath: string,
  interactionId: string
): boolean {
  return log.entries.some(
    (e) =>
      e.environment === environment &&
      e.pagePath === pagePath &&
      e.interactionId === interactionId &&
      e.status === "success"
  );
}

/**
 * Check if a specific interaction previously failed
 */
export function hasFailed(
  log: InteractionLog,
  environment: string,
  pagePath: string,
  interactionId: string
): boolean {
  return log.entries.some(
    (e) =>
      e.environment === environment &&
      e.pagePath === pagePath &&
      e.interactionId === interactionId &&
      e.status === "failed"
  );
}

/**
 * Clear failed entries for retry
 */
export function clearFailedEntries(log: InteractionLog): void {
  log.entries = log.entries.filter((e) => e.status !== "failed");
  log.summary.failed = 0;
  log.summary.total = log.entries.length;
  saveLog(log);
}

/**
 * Print a summary of the log to console
 */
export function printLogSummary(log: InteractionLog): void {
  console.log("\n--- Interaction Log Summary ---");
  console.log(`Started: ${log.startedAt}`);
  console.log(`Last Updated: ${log.lastUpdated}`);
  console.log(`Total: ${log.summary.total}`);
  console.log(`  ✅ Success: ${log.summary.success}`);
  console.log(`  ❌ Failed: ${log.summary.failed}`);
  console.log(`  ⏭️  Skipped: ${log.summary.skipped}`);
  
  if (log.summary.failed > 0) {
    console.log("\n--- Failed Interactions ---");
    const failed = getFailedInteractions(log);
    for (const entry of failed) {
      console.log(`  [${entry.environment}] ${entry.pagePath}`);
      console.log(`    → ${entry.interactionId}: ${entry.description}`);
      console.log(`    Error: ${entry.error?.substring(0, 100)}...`);
    }
  }
  console.log("-------------------------------\n");
}

/**
 * Generate a markdown report of failures
 */
export function generateFailureReport(log: InteractionLog): string {
  const failed = getFailedInteractions(log);
  
  if (failed.length === 0) {
    return "# Interaction Log\n\nAll interactions completed successfully! 🎉\n";
  }
  
  let md = "# Interaction Failures Report\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `- Total Interactions: ${log.summary.total}\n`;
  md += `- ✅ Success: ${log.summary.success}\n`;
  md += `- ❌ Failed: ${log.summary.failed}\n`;
  md += `- ⏭️ Skipped: ${log.summary.skipped}\n\n`;
  
  md += `## Failed Interactions\n\n`;
  
  const byPage = getFailedByPage(log);
  for (const [key, entries] of byPage) {
    md += `### ${key}\n\n`;
    for (const entry of entries) {
      md += `#### ${entry.interactionId}\n\n`;
      md += `- **Description:** ${entry.description}\n`;
      md += `- **Time:** ${entry.timestamp}\n`;
      md += `- **Error:**\n\`\`\`\n${entry.error}\n\`\`\`\n\n`;
    }
  }
  
  return md;
}

/**
 * Save failure report to file
 */
export function saveFailureReport(log: InteractionLog): string {
  const reportPath = path.join(getScreenshotsDir(), "failure-report.md");
  const content = generateFailureReport(log);
  writeFileSync(reportPath, content, "utf-8");
  return reportPath;
}
