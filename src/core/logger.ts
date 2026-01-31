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
 * Check if an interaction has already succeeded in the log
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
 * Print log summary to console
 */
export function printLogSummary(log: InteractionLog): void {
  console.log("\n--- Interaction Log ---");
  console.log(`Total: ${log.summary.total}`);
  console.log(`  ✅ Success: ${log.summary.success}`);
  console.log(`  ❌ Failed: ${log.summary.failed}`);
  console.log(`  ⏭️  Skipped: ${log.summary.skipped}`);
  console.log("------------------------\n");
}

/**
 * Generate failure report markdown
 */
function generateFailureReport(log: InteractionLog): string {
  const failed = getFailedInteractions(log);
  
  if (failed.length === 0) {
    return "# Interaction Report\n\nNo failures recorded. ✅\n";
  }
  
  let md = `# Interaction Failure Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `- Total interactions: ${log.summary.total}\n`;
  md += `- ✅ Success: ${log.summary.success}\n`;
  md += `- ❌ Failed: ${log.summary.failed}\n`;
  md += `- ⏭️ Skipped: ${log.summary.skipped}\n\n`;
  
  md += `## Failed Interactions\n\n`;
  
  const byPage = getFailedByPage(log);
  
  for (const [key, entries] of byPage) {
    const [env, pagePath] = key.split(":");
    md += `### ${env}: ${pagePath}\n\n`;
    
    for (const entry of entries) {
      md += `- **${entry.interactionId}**: ${entry.description}\n`;
      if (entry.error) {
        md += `  - Error: \`${entry.error.substring(0, 200)}\`\n`;
      }
      if (entry.duration) {
        md += `  - Duration: ${entry.duration}ms\n`;
      }
    }
    md += "\n";
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
