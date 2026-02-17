#!/usr/bin/env bun
/**
 * UI Police — Playwright Codegen CLI
 *
 * Standalone entry point to record a Playwright script for an app.
 * The recorded script is saved under output/captures/scripts/{app}/
 * and registered so the capture pipeline can execute it.
 *
 * Usage:
 *   bun run codegen                  # interactive prompts
 *   bun run codegen auth             # specify app
 *   bun run codegen auth develop     # specify app + env
 *   bun run codegen auth develop my-flow  # specify app + env + script name
 */

import {
  APP_LIST,
  environments,
  setCurrentApp,
  getAppConfig,
  projectConfig,
} from "../core/config";
import { startRecording, saveRecordedScript, listScripts } from "../core/recorder";
import { log, style, symbols } from "../utils/terminal";
import * as readline from "readline";

// ============================================
// HELPERS
// ============================================

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printUsage(): void {
  console.log(`\n  🚔 UI Police Codegen — v${projectConfig.version}`);
  console.log(`  ${"─".repeat(40)}`);
  console.log(`  Record a Playwright script for any app.\n`);
  console.log(`  ${style.dim("Usage:")}`);
  console.log(`    bun run codegen [app] [env] [name]\n`);
  console.log(`  ${style.dim("Examples:")}`);
  console.log(`    bun run codegen`);
  console.log(`    bun run codegen auth`);
  console.log(`    bun run codegen auth develop`);
  console.log(`    bun run codegen auth develop my-login-flow\n`);
  console.log(`  ${style.dim("Available apps:")} ${APP_LIST.join(", ")}`);
  console.log(`  ${style.dim("Available envs:")} ${environments.map((e) => e.name).join(", ")}\n`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);

  // Help flag
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  let appName = args[0];
  let envName = args[1];
  let scriptName = args[2];

  // Interactive app selection
  if (!appName) {
    console.log(`\n  🚔 UI Police Codegen\n`);
    console.log(`  ${style.dim("Select an app to record:")}`);
    APP_LIST.forEach((name, i) => {
      console.log(`    ${i + 1}. ${name}`);
    });
    const choice = await prompt(`\n  Your choice [1]: `);
    const index = parseInt(choice || "1", 10) - 1;
    appName = APP_LIST[index] ?? APP_LIST[0]!;
  }

  // Validate app
  if (!APP_LIST.includes(appName)) {
    log.error(`Unknown app: "${appName}". Available: ${APP_LIST.join(", ")}`);
    process.exit(1);
  }

  setCurrentApp(appName);

  // Interactive env selection
  if (!envName) {
    if (environments.length === 1) {
      envName = environments[0]!.name;
    } else {
      console.log(`\n  ${style.dim("Select environment:")}`);
      environments.forEach((env, i) => {
        console.log(`    ${i + 1}. ${env.name} — ${style.dim(env.baseUrl)}`);
      });
      const choice = await prompt(`\n  Your choice [1]: `);
      const index = parseInt(choice || "1", 10) - 1;
      envName = environments[index]?.name ?? environments[0]!.name;
    }
  }

  // Validate env
  const env = environments.find((e) => e.name === envName);
  if (!env) {
    log.error(`Unknown environment: "${envName}". Available: ${environments.map((e) => e.name).join(", ")}`);
    process.exit(1);
  }

  // Script name
  if (!scriptName) {
    scriptName = (await prompt(`  Script name [auto]: `)) || undefined;
  }

  // Record
  console.log("");
  const code = await startRecording(appName, envName);

  if (!code) {
    log.warning("No actions were recorded.");
    process.exit(0);
  }

  const filepath = saveRecordedScript(appName, code, scriptName);
  console.log("");

  // Show all scripts for this app
  const scripts = listScripts(appName);
  if (scripts.length > 0) {
    console.log(`  ${style.dim(`${scripts.length} script(s) for ${appName}:`)}`);
    for (const s of scripts) {
      console.log(`    ${symbols.bullet} ${style.highlight(s.name)} — ${s.description}`);
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
