/**
 * Terminal output utilities with colors and formatting
 * Uses ANSI escape codes for cross-platform terminal styling
 */

// ANSI Color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  
  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  
  // Bright foreground
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  
  // Custom colors
  orange: "\x1b[38;5;208m", // Orange (256-color mode)
};

// Symbols for visual output
export const symbols = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  arrow: "→",
  arrowRight: "›",
  bullet: "•",
  line: "─",
  corner: "└",
  tee: "├",
  vertical: "│",
  // Aliases
  check: "✓",
  cross: "✗",
};

// Color helper functions
export const style = {
  reset: (text: string) => `${colors.reset}${text}${colors.reset}`,
  bold: (text: string) => `${colors.bold}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
  
  // Colors
  red: (text: string) => `${colors.red}${text}${colors.reset}`,
  green: (text: string) => `${colors.green}${text}${colors.reset}`,
  yellow: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  blue: (text: string) => `${colors.blue}${text}${colors.reset}`,
  magenta: (text: string) => `${colors.magenta}${text}${colors.reset}`,
  cyan: (text: string) => `${colors.orange}${text}${colors.reset}`,
  gray: (text: string) => `${colors.gray}${text}${colors.reset}`,
  white: (text: string) => `${colors.white}${text}${colors.reset}`,
  orange: (text: string) => `${colors.orange}${text}${colors.reset}`,
  
  // Semantic
  success: (text: string) => `${colors.green}${text}${colors.reset}`,
  error: (text: string) => `${colors.red}${text}${colors.reset}`,
  warning: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  info: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  path: (text: string) => `${colors.brightCyan}${text}${colors.reset}`,
  url: (text: string) => `${colors.orange}${text}${colors.reset}`,
  highlight: (text: string) => `${colors.brightMagenta}${text}${colors.reset}`,
  muted: (text: string) => `${colors.gray}${text}${colors.reset}`,
  count: (text: string) => `${colors.brightYellow}${colors.bold}${text}${colors.reset}`,
  header: (text: string) => `${colors.bold}${colors.cyan}${text}${colors.reset}`,
  
  // Combined
  successBold: (text: string) => `${colors.bold}${colors.green}${text}${colors.reset}`,
  errorBold: (text: string) => `${colors.bold}${colors.red}${text}${colors.reset}`,
  headerBold: (text: string) => `${colors.bold}${colors.white}${text}${colors.reset}`,
};

// Indentation
const INDENT = "  ";

function indent(level: number): string {
  return INDENT.repeat(level);
}

/**
 * Logger with consistent formatting and colors
 */
export const log = {
  // Header/section breaks
  header: (text: string) => {
    const line = style.gray(symbols.line.repeat(50));
    console.log("");
    console.log(line);
    console.log(style.headerBold(`  ${text}`));
    console.log(line);
  },

  subheader: (text: string) => {
    console.log("");
    console.log(style.bold(`${symbols.arrowRight} ${text}`));
  },

  // Standard log levels
  info: (text: string, indentLevel = 0) => {
    console.log(`${indent(indentLevel)}${style.info(symbols.info)} ${text}`);
  },

  success: (text: string, indentLevel = 0) => {
    console.log(`${indent(indentLevel)}${style.success(symbols.success)} ${text}`);
  },

  error: (text: string, indentLevel = 0) => {
    console.log(`${indent(indentLevel)}${style.error(symbols.error)} ${text}`);
  },

  warning: (text: string, indentLevel = 0) => {
    console.log(`${indent(indentLevel)}${style.warning(symbols.warning)} ${text}`);
  },

  // Step without numbers (simple)
  step: (text: string) => {
    console.log(`\n${style.cyan(symbols.arrow)} ${style.bold(text)}`);
  },

  // Contextual logs
  action: (text: string, indentLevel = 1) => {
    console.log(`${indent(indentLevel)}${style.cyan(symbols.arrow)} ${text}`);
  },

  item: (text: string, indentLevel = 1) => {
    console.log(`${indent(indentLevel)}${style.gray(symbols.bullet)} ${text}`);
  },

  // File/path related
  fileSaved: (filepath: string, prefix = "Saved", indentLevel = 2) => {
    console.log(`${indent(indentLevel)}${style.success(symbols.success)} ${prefix}: ${style.path(filepath)}`);
  },

  fileSkipped: (filepath: string, reason: string, indentLevel = 2) => {
    console.log(`${indent(indentLevel)}${style.gray(symbols.arrow)} Skipped: ${style.muted(filepath)} ${style.muted(`(${reason})`)}`);
  },

  fileFailed: (filepath: string, error: string, indentLevel = 2) => {
    console.log(`${indent(indentLevel)}${style.error(symbols.error)} Failed: ${style.path(filepath)}`);
    console.log(`${indent(indentLevel + 1)}${style.muted(error.substring(0, 80))}`);
  },

  // Environment/URL
  env: (name: string, url: string) => {
    console.log(`${indent(1)}${style.bold(name.toUpperCase())}: ${style.url(url)}`);
  },

  // Page capture - simple version
  page: (pagePath: string, current?: number, total?: number, indentLevel = 1) => {
    const progress = current && total ? style.muted(`[${current}/${total}] `) : "";
    console.log(`${indent(indentLevel)}${style.cyan(symbols.arrow)} ${progress}Capturing ${style.path(pagePath)}`);
  },

  // Interaction - simple version
  interaction: (description: string, indentLevel = 2) => {
    console.log(`${indent(indentLevel)}${style.cyan(symbols.arrow)} Interaction: ${description}`);
  },

  // Newline
  blank: () => console.log(""),

  // Raw (no formatting)
  raw: (text: string) => console.log(text),

  // Tree-style output
  tree: (items: string[], indentLevel = 1) => {
    items.forEach((item, i) => {
      const prefix = i === items.length - 1 ? symbols.corner : symbols.tee;
      console.log(`${indent(indentLevel)}${style.gray(prefix)} ${item}`);
    });
  },

  // Summary stats
  summary: (title: string, stats: Record<string, string | number>) => {
    console.log("");
    console.log(style.bold(`  ${title}`));
    console.log(style.gray("  " + symbols.line.repeat(30)));
    for (const [key, value] of Object.entries(stats)) {
      console.log(`  ${style.gray(key + ":")} ${style.bold(String(value))}`);
    }
  },
};

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Banner for startup
 */
export function printBanner() {
  console.log("");
  console.log(style.orange("  ╔═══════════════════════════════════════════╗"));
  console.log(style.orange("  ║") + style.bold("     🚔 Cariloop UI Police                 ") + style.orange("║"));
  console.log(style.orange("  ║") + style.dim("     Visual Regression Testing Tool        ") + style.orange("║"));
  console.log(style.orange("  ╚═══════════════════════════════════════════╝"));
  console.log("");
}

/**
 * Menu display helper
 */
export function printMenu(title: string, options: { key: string; label: string; description?: string }[]) {
  console.log("");
  console.log(style.bold(`  ${title}`));
  console.log(style.gray("  " + symbols.line.repeat(40)));
  console.log("");
  
  for (const opt of options) {
    const key = style.orange(`[${opt.key}]`);
    const label = style.white(opt.label);
    const desc = opt.description ? style.dim(` - ${opt.description}`) : "";
    console.log(`    ${key} ${label}${desc}`);
  }
  
  console.log("");
}

/**
 * Display comparison results summary
 */
export function printComparisonSummary(
  totalPages: number,
  avgDiff: number,
  reportPath: string
) {
  console.log("");
  console.log(style.orange("  ╔═══════════════════════════════════════════╗"));
  console.log(style.orange("  ║") + style.bold("            ✅ Done!                       ") + style.orange("║"));
  console.log(style.orange("  ╚═══════════════════════════════════════════╝"));
  console.log("");
  console.log(`  ${style.bold("Pages compared:")}  ${style.count(String(totalPages))}`);
  console.log(`  ${style.bold("Avg difference:")} ${avgDiff < 1 ? style.success(`${avgDiff.toFixed(2)}%`) : avgDiff < 5 ? style.warning(`${avgDiff.toFixed(2)}%`) : style.error(`${avgDiff.toFixed(2)}%`)}`);
  console.log(`  ${style.bold("Report:")}         ${style.path(reportPath)}`);
}

/**
 * Display app selection result
 */
export function printAppSelected(displayName: string, outputDir: string, pathPrefix: string) {
  console.log("");
  console.log(`  ${style.success(symbols.success)} Selected: ${style.bold(displayName)}`);
  console.log(`    ${style.dim("Output:")} ${style.path(outputDir + "/")}`);
  console.log(`    ${style.dim("Path prefix:")} ${style.orange(pathPrefix || "(root)")}`);
  console.log("");
}

/**
 * Progress indicator for environments
 */
export function printEnvProgress(envName: string, baseUrl: string, status: "starting" | "complete" | "failed") {
  const statusText = {
    starting: style.cyan("Starting..."),
    complete: style.success("Complete"),
    failed: style.error("Failed"),
  };
  
  console.log("");
  console.log(`  ${style.bold(envName.toUpperCase())} ${style.dim("│")} ${style.url(baseUrl)}`);
  console.log(`  ${style.dim(symbols.line.repeat(40))} ${statusText[status]}`);
}

/**
 * Display Minikube reminder
 */
export function printMinikubeReminder() {
  console.log("");
  console.log(style.orange("  ╔═══════════════════════════════════════════╗"));
  console.log(style.orange("  ║") + style.bold("     ⚠️  Local Environment Requirements     ") + style.orange("║"));
  console.log(style.orange("  ╚═══════════════════════════════════════════╝"));
  console.log("");
  console.log(`  ${style.warning(symbols.warning)} ${style.bold("Before running local tests, ensure:")}`);
  console.log("");
  console.log(`    ${style.orange(symbols.bullet)} Minikube is running: ${style.cyan("minikube status")}`);
  console.log(`    ${style.orange(symbols.bullet)} Tunnel is active: ${style.cyan("minikube tunnel")}`);
  console.log(`    ${style.orange(symbols.bullet)} Project is deployed in Minikube`);
  console.log("");
}

/**
 * Display reload hint
 */
export function printReloadHint() {
  console.log(`\n  ${style.dim("💡 When finished, you can press")} ${style.orange("'r'")} ${style.dim("to run again")}\n`);
}
