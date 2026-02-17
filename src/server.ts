/**
 * UI Police — Web Dashboard Server
 *
 * Starts a Bun HTTP server with:
 *   - REST API for triggering captures, comparisons, reports, codegen
 *   - WebSocket for real-time log streaming to the browser
 *   - Self-contained HTML dashboard served at /
 *
 * Usage: bun run src/server.ts
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import {
  projectConfig,
  environments,
  APP_LIST,
  APPS,
  setCurrentApp,
  getCurrentApp,
  getAllApps,
} from "./core/config";
import { listRuns, getLatestRun, loadRunManifest, getAppDir, getDiffPairDir, deleteRun, cancelRun } from "./core/runs";
import {
  listScripts,
  getScriptContent,
  saveRawScript,
  updateScript,
  deleteScript,
  runScript,
  executeSelectedScripts,
  stopRecording,
  isCodegenRunning,
} from "./core/recorder";
import { captureAll } from "./core/capture";
import { compareScreenshots, compareCrossEnv, compareCrossRun } from "./core/compare";
import { generateReport, generateMainIndex } from "./core/report";
import {
  addClient,
  removeClient,
  startIntercepting,
  stopIntercepting,
  broadcastStatus,
  broadcastDone,
  broadcastLog,
} from "./core/log-stream";
import {
  loadProgress,
  createFreshManifest,
  deleteProgress,
} from "./core/progress";
import { createFreshLog } from "./core/logger";

// ============================================
// STATE
// ============================================

let isRunning = false;
let currentPhase = "idle";
let shouldStop = false;

// ============================================
// DASHBOARD HTML
// ============================================

const DASHBOARD_PATH = path.join(import.meta.dir, "ui", "dashboard.html");

function serveDashboard(): Response {
  if (!existsSync(DASHBOARD_PATH)) {
    return new Response("Dashboard HTML not found. Build it first.", { status: 500 });
  }
  const html = readFileSync(DASHBOARD_PATH, "utf-8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ============================================
// API HANDLERS
// ============================================

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function errorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

/** GET /api/config */
function handleGetConfig(): Response {
  const apps = getAllApps().map((a) => ({
    name: a.name,
    displayName: a.displayName,
    pathPrefix: a.pathPrefix,
    requiresAuth: a.requiresAuth,
  }));
  return jsonResponse({
    version: projectConfig.version,
    environments: environments.map((e) => ({ name: e.name, baseUrl: e.baseUrl })),
    apps,
    currentApp: getCurrentApp(),
  });
}

/** GET /api/runs?app=xxx */
function handleGetRuns(url: URL): Response {
  const app = url.searchParams.get("app");
  const runs = listRuns(app ?? undefined);
  return jsonResponse({ runs });
}

/** DELETE /api/runs/delete — remove a specific run */
async function handleDeleteRun(req: Request): Promise<Response> {
  const body = (await req.json()) as { app: string; env: string; runId: string };
  if (!body.app || !body.env || !body.runId) return errorResponse("Missing app, env, or runId");

  const ok = deleteRun(body.app, body.env, body.runId);
  if (!ok) return errorResponse("Run not found", 404);
  return jsonResponse({ message: "Run deleted", app: body.app, env: body.env, runId: body.runId });
}

/** POST /api/runs/rerun — re-run capture for a specific app+env (cancels incomplete run first) */
async function handleRerunCapture(req: Request): Promise<Response> {
  if (isRunning) return errorResponse("A process is already running", 409);

  const body = (await req.json()) as { app: string; env: string; runId?: string };
  if (!body.app || !body.env) return errorResponse("Missing app or env");

  // If a specific incomplete runId was given, cancel it so a fresh one starts
  if (body.runId) {
    cancelRun(body.app, body.env, body.runId);
  }

  setCurrentApp(body.app);
  isRunning = true;
  shouldStop = false;
  currentPhase = "capturing";

  startIntercepting();
  broadcastStatus({ phase: "capturing", app: body.app });

  (async () => {
    try {
      broadcastLog(`\n═══ Re-running capture for ${body.app}/${body.env} ═══`);
      const result = await captureAll(undefined, undefined, () => shouldStop);
      broadcastDone({
        success: true,
        phase: "capture",
        detail: `Re-capture complete for ${body.env}`,
      });
    } catch (err: any) {
      broadcastDone({ success: false, phase: "capture", detail: err.message });
    } finally {
      isRunning = false;
      currentPhase = "idle";
      shouldStop = false;
      stopIntercepting();
    }
  })();

  return jsonResponse({ message: "Re-run started", app: body.app, env: body.env });
}

/** GET /api/scripts?app=xxx */
function handleGetScripts(url: URL): Response {
  const app = url.searchParams.get("app") ?? getCurrentApp();
  const scripts = listScripts(app);
  return jsonResponse({ scripts });
}

/** GET /api/status */
function handleGetStatus(): Response {
  return jsonResponse({
    isRunning,
    currentPhase,
    currentApp: getCurrentApp(),
  });
}

/** POST /api/capture */
async function handleCapture(req: Request): Promise<Response> {
  if (isRunning) return errorResponse("A process is already running", 409);

  const body = (await req.json()) as { app?: string };
  const app = body.app ?? getCurrentApp();

  setCurrentApp(app);
  isRunning = true;
  currentPhase = "capturing";

  // Run capture in background
  startIntercepting();
  broadcastStatus({ phase: "capturing", app });

  // Don't await — let it run async and stream logs
  (async () => {
    try {
      deleteProgress();
      const result = await captureAll();
      broadcastDone({ success: true, phase: "capture", detail: `${Object.keys(result.runIds).length} environments captured` });
    } catch (err: any) {
      broadcastDone({ success: false, phase: "capture", detail: err.message });
    } finally {
      isRunning = false;
      currentPhase = "idle";
      stopIntercepting();
    }
  })();

  return jsonResponse({ message: "Capture started", app });
}

/** POST /api/compare */
async function handleCompare(req: Request): Promise<Response> {
  if (isRunning) return errorResponse("A process is already running", 409);

  const body = (await req.json()) as { app?: string };
  const app = body.app ?? getCurrentApp();

  setCurrentApp(app);
  isRunning = true;
  currentPhase = "comparing";

  startIntercepting();
  broadcastStatus({ phase: "comparing", app });

  (async () => {
    try {
      const results = compareScreenshots([]);
      broadcastDone({ success: true, phase: "compare", detail: `${results.length} pages compared` });
    } catch (err: any) {
      broadcastDone({ success: false, phase: "compare", detail: err.message });
    } finally {
      isRunning = false;
      currentPhase = "idle";
      stopIntercepting();
    }
  })();

  return jsonResponse({ message: "Comparison started", app });
}

/** POST /api/report */
async function handleReport(req: Request): Promise<Response> {
  if (isRunning) return errorResponse("A process is already running", 409);

  const body = (await req.json()) as { app?: string };
  const app = body.app ?? getCurrentApp();

  setCurrentApp(app);
  isRunning = true;
  currentPhase = "reporting";

  startIntercepting();
  broadcastStatus({ phase: "reporting", app });

  (async () => {
    try {
      const results = compareScreenshots([]);
      const reportPath = generateReport(results);
      generateMainIndex();
      broadcastDone({ success: true, phase: "report", detail: reportPath });
    } catch (err: any) {
      broadcastDone({ success: false, phase: "report", detail: err.message });
    } finally {
      isRunning = false;
      currentPhase = "idle";
      stopIntercepting();
    }
  })();

  return jsonResponse({ message: "Report generation started", app });
}

/** POST /api/pipeline — task-based pipeline with stop/resume support */
async function handlePipeline(req: Request): Promise<Response> {
  if (isRunning) return errorResponse("A process is already running", 409);

  const body = (await req.json()) as {
    app?: string;
    tasks?: { capture?: boolean; scripts?: string[]; compare?: boolean; report?: boolean };
    resume?: boolean;
  };
  const app = body.app ?? getCurrentApp();
  const tasks = body.tasks ?? { capture: true, scripts: [], compare: true, report: true };
  const resume = body.resume ?? false;

  setCurrentApp(app);
  isRunning = true;
  shouldStop = false;
  currentPhase = "pipeline";

  startIntercepting();
  broadcastStatus({ phase: "pipeline", app });

  (async () => {
    let stepNum = 0;
    const totalSteps = [tasks.capture, (tasks.scripts && tasks.scripts.length > 0), tasks.compare, tasks.report].filter(Boolean).length;
    let captureResult: { runIds: Record<string, string> } | null = null;

    try {
      // Step: Capture
      if (tasks.capture && !shouldStop) {
        stepNum++;
        currentPhase = "capturing";
        broadcastStatus({ phase: "capturing", app });
        broadcastLog(`\n═══ Step ${stepNum}/${totalSteps}: Capturing screenshots${resume ? " (resuming)" : ""} ═══`);

        if (!resume) deleteProgress();
        captureResult = await captureAll(undefined, undefined, () => shouldStop);
      }

      if (shouldStop) { broadcastDone({ success: false, phase: "pipeline", detail: "Stopped by user after capture" }); return; }

      // Step: Scripts
      if (tasks.scripts && tasks.scripts.length > 0 && !shouldStop) {
        stepNum++;
        currentPhase = "script";
        broadcastStatus({ phase: "script", app });
        broadcastLog(`\n═══ Step ${stepNum}/${totalSteps}: Running ${tasks.scripts.length} script(s) ═══`);
        await executeSelectedScripts(app, tasks.scripts);
      }

      if (shouldStop) { broadcastDone({ success: false, phase: "pipeline", detail: "Stopped by user after scripts" }); return; }

      // Step: Compare
      if (tasks.compare && !shouldStop) {
        stepNum++;
        currentPhase = "comparing";
        broadcastStatus({ phase: "comparing", app });
        broadcastLog(`\n═══ Step ${stepNum}/${totalSteps}: Comparing screenshots ═══`);
        compareScreenshots([]);
      }

      if (shouldStop) { broadcastDone({ success: false, phase: "pipeline", detail: "Stopped by user after compare" }); return; }

      // Step: Report
      if (tasks.report && !shouldStop) {
        stepNum++;
        currentPhase = "reporting";
        broadcastStatus({ phase: "reporting", app });
        broadcastLog(`\n═══ Step ${stepNum}/${totalSteps}: Generating report ═══`);
        const results = compareScreenshots([]);
        const reportPath = generateReport(results);
        generateMainIndex();
      }

      const envCount = captureResult ? Object.keys(captureResult.runIds).length : 0;
      broadcastDone({
        success: true,
        phase: "pipeline",
        detail: `${totalSteps} tasks completed${envCount > 0 ? `, ${envCount} envs captured` : ""}`,
      });
    } catch (err: any) {
      broadcastDone({ success: false, phase: "pipeline", detail: err.message });
    } finally {
      isRunning = false;
      currentPhase = "idle";
      shouldStop = false;
      stopIntercepting();
    }
  })();

  return jsonResponse({ message: "Pipeline started", app, tasks });
}

/** POST /api/pipeline/stop — signal the pipeline to stop between tasks */
function handlePipelineStop(): Response {
  if (!isRunning) return errorResponse("No pipeline running", 400);
  shouldStop = true;
  broadcastLog("\n⚠ Stop requested — pipeline will halt after the current task completes...");
  return jsonResponse({ message: "Stop signal sent" });
}

/** GET /api/progress?app=xxx — check if resumable progress exists */
function handleGetProgress(url: URL): Response {
  const app = url.searchParams.get("app") ?? getCurrentApp();
  setCurrentApp(app);
  const progress = loadProgress();
  if (!progress) {
    return jsonResponse({ hasProgress: false });
  }

  return jsonResponse({
    hasProgress: true,
    discoveredPages: progress.discoveredPages.length,
    environments: Object.fromEntries(
      Object.entries(progress.environments).map(([env, data]) => [
        env,
        {
          capturedPages: data.capturedPages.length,
          complete: data.complete,
          lastUpdated: data.lastUpdated,
        },
      ])
    ),
  });
}

/** POST /api/report/index — regenerate just the main reports index */
async function handleReportIndex(_req: Request): Promise<Response> {
  try {
    generateMainIndex();
    return jsonResponse({ message: "Main index regenerated", url: "/reports/index.html" });
  } catch (err: any) {
    return errorResponse(err.message, 500);
  }
}

/** GET /api/scripts/read?app=xxx&name=yyy */
function handleGetScriptContent(url: URL): Response {
  const app = url.searchParams.get("app") ?? getCurrentApp();
  const name = url.searchParams.get("name");
  if (!name) return errorResponse("Missing script name");

  const content = getScriptContent(app, name);
  if (content === null) return errorResponse("Script not found", 404);
  return jsonResponse({ name, content });
}

/** POST /api/scripts/save */
async function handleSaveScript(req: Request): Promise<Response> {
  const body = (await req.json()) as { app?: string; name: string; code: string; description?: string };
  const app = body.app ?? getCurrentApp();
  if (!body.name || !body.code) return errorResponse("Missing name or code");

  const filepath = saveRawScript(app, body.code, body.name, body.description);
  return jsonResponse({ message: "Script saved", filepath });
}

/** PUT /api/scripts/update */
async function handleUpdateScript(req: Request): Promise<Response> {
  const body = (await req.json()) as { app?: string; name: string; code?: string; description?: string };
  const app = body.app ?? getCurrentApp();
  if (!body.name) return errorResponse("Missing script name");

  const ok = updateScript(app, body.name, body.code, body.description);
  if (!ok) return errorResponse("Script not found", 404);
  return jsonResponse({ message: "Script updated" });
}

/** DELETE /api/scripts/delete */
async function handleDeleteScript(req: Request): Promise<Response> {
  const body = (await req.json()) as { app?: string; name: string };
  const app = body.app ?? getCurrentApp();
  if (!body.name) return errorResponse("Missing script name");

  const ok = deleteScript(app, body.name);
  if (!ok) return errorResponse("Script not found", 404);
  return jsonResponse({ message: "Script deleted" });
}

/** POST /api/scripts/run */
async function handleRunScript(req: Request): Promise<Response> {
  if (isRunning) return errorResponse("A process is already running", 409);

  const body = (await req.json()) as { app?: string; name: string };
  const app = body.app ?? getCurrentApp();
  if (!body.name) return errorResponse("Missing script name");

  setCurrentApp(app);
  isRunning = true;
  currentPhase = "script";

  startIntercepting();
  broadcastStatus({ phase: "script", app });

  (async () => {
    try {
      const success = await runScript(app, body.name);
      broadcastDone({ success, phase: "script", detail: success ? `${body.name} completed` : `${body.name} failed` });
    } catch (err: any) {
      broadcastDone({ success: false, phase: "script", detail: err.message });
    } finally {
      isRunning = false;
      currentPhase = "idle";
      stopIntercepting();
    }
  })();

  return jsonResponse({ message: "Script execution started", app, name: body.name });
}

/** GET /api/reports?app=xxx */
function handleGetReports(url: URL): Response {
  const reportsBase = "output/reports";
  if (!existsSync(reportsBase)) return jsonResponse({ reports: [] });

  const appFilter = url.searchParams.get("app");
  const reports: { app: string; displayName: string; url: string; exists: boolean }[] = [];

  // Scan for per-app report directories
  try {
    const entries = readdirSync(reportsBase, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("cariloop-")) {
        const appName = entry.name.replace("cariloop-", "");
        if (appFilter && appName !== appFilter) continue;
        const indexPath = path.join(reportsBase, entry.name, "index.html");
        const appConfig = getAllApps().find(a => a.name === appName);
        reports.push({
          app: appName,
          displayName: appConfig?.displayName ?? entry.name,
          url: `/reports/${entry.name}/index.html`,
          exists: existsSync(indexPath),
        });
      }
    }
  } catch { /* dir may not exist yet */ }

  // Main index
  const mainIndexPath = path.join(reportsBase, "index.html");
  const mainIndex = existsSync(mainIndexPath) ? `/reports/index.html` : null;

  return jsonResponse({ mainIndex, reports });
}

/** POST /api/codegen */
async function handleCodegen(req: Request): Promise<Response> {
  if (isRunning) return errorResponse("A process is already running", 409);

  const body = (await req.json()) as { app?: string; env?: string; name?: string };
  const app = body.app ?? getCurrentApp();
  const env = body.env ?? environments[0]?.name ?? "develop";

  setCurrentApp(app);
  isRunning = true;
  currentPhase = "codegen";

  startIntercepting();
  broadcastStatus({ phase: "codegen", app, env });

  const { startRecording, saveRecordedScript } = await import("./core/recorder");

  (async () => {
    try {
      broadcastLog(`Starting Playwright Codegen for ${app} (${env})...`);
      broadcastLog("A browser window will open. Interact with it, then close when done.");

      const code = await startRecording(app, env);
      if (code) {
        const filepath = saveRecordedScript(app, code, body.name);
        broadcastDone({ success: true, phase: "codegen", detail: `Script saved to ${filepath}` });
      } else {
        broadcastDone({ success: false, phase: "codegen", detail: "No actions were recorded" });
      }
    } catch (err: any) {
      broadcastDone({ success: false, phase: "codegen", detail: err.message });
    } finally {
      isRunning = false;
      currentPhase = "idle";
      stopIntercepting();
    }
  })();

  return jsonResponse({ message: "Codegen started", app, env });
}

/** POST /api/codegen/stop — kill the active codegen process */
async function handleCodegenStop(_req: Request): Promise<Response> {
  if (currentPhase !== "codegen") return errorResponse("No codegen process running", 400);
  stopRecording();
  broadcastDone({ success: false, phase: "codegen", detail: "Recording stopped by user" });
  isRunning = false;
  currentPhase = "idle";
  stopIntercepting();
  return jsonResponse({ message: "Codegen stopped" });
}

/** POST /api/compare/custom — compare two specific runs */
async function handleCompareCustom(req: Request): Promise<Response> {
  const body = (await req.json()) as {
    app: string;
    env1: string;
    runId1: string;
    env2: string;
    runId2: string;
  };

  if (!body.app || !body.env1 || !body.runId1 || !body.env2 || !body.runId2) {
    return errorResponse("Missing required fields: app, env1, runId1, env2, runId2");
  }

  // Determine diff label and check if it already exists
  const isCrossEnv = body.env1 !== body.env2;
  const diffLabel = isCrossEnv
    ? `${body.env1}-vs-${body.env2}`
    : `${body.env1}-${body.runId1}-vs-${body.runId2}`;
  const diffDir = getDiffPairDir(body.app, diffLabel);

  // Check if diffs already exist (has .png files in it)
  if (existsSync(diffDir)) {
    const existing = readdirSync(diffDir).filter(f => f.endsWith(".png"));
    if (existing.length > 0) {
      return jsonResponse({
        message: "Diff already exists",
        cached: true,
        diffLabel,
        diffDir,
        fileCount: existing.length,
      });
    }
  }

  // Run the comparison (blocking but fast — it's just pixel math)
  if (isRunning) return errorResponse("A process is already running", 409);

  setCurrentApp(body.app);
  isRunning = true;
  currentPhase = "comparing";

  startIntercepting();
  broadcastStatus({ phase: "comparing", app: body.app });

  (async () => {
    try {
      let results;
      if (isCrossEnv) {
        results = compareCrossEnv(body.app, body.env1, body.runId1, body.env2, body.runId2);
      } else {
        results = compareCrossRun(body.app, body.env1, body.runId1, body.runId2);
      }
      const reportPath = generateReport(results);
      generateMainIndex();
      broadcastDone({
        success: true,
        phase: "compare",
        detail: `${results.length} pages compared (${diffLabel}), report: ${reportPath}`,
      });
    } catch (err: any) {
      broadcastDone({ success: false, phase: "compare", detail: err.message });
    } finally {
      isRunning = false;
      currentPhase = "idle";
      stopIntercepting();
    }
  })();

  return jsonResponse({ message: "Custom comparison started", diffLabel, cached: false });
}

// ============================================
// SERVER
// ============================================

const PORT = parseInt(process.env.UI_POLICE_PORT ?? "3737", 10);

const server = Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return undefined as unknown as Response;
      return errorResponse("WebSocket upgrade failed", 500);
    }

    // Static: serve dashboard
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return serveDashboard();
    }

    // Serve report files from output/reports/
    if (url.pathname.startsWith("/reports/")) {
      const filePath = path.join("output", url.pathname);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath);
        const ext = path.extname(filePath);
        const contentType = ext === ".html" ? "text/html" : ext === ".json" ? "application/json" : "application/octet-stream";
        return new Response(content, { headers: { "Content-Type": contentType } });
      }
      return new Response("Not found", { status: 404 });
    }

    // API routes
    if (url.pathname === "/api/config" && req.method === "GET") return handleGetConfig();
    if (url.pathname === "/api/runs" && req.method === "GET") return handleGetRuns(url);
    if (url.pathname === "/api/runs/delete" && req.method === "DELETE") return handleDeleteRun(req);
    if (url.pathname === "/api/runs/rerun" && req.method === "POST") return handleRerunCapture(req);
    if (url.pathname === "/api/scripts" && req.method === "GET") return handleGetScripts(url);
    if (url.pathname === "/api/scripts/read" && req.method === "GET") return handleGetScriptContent(url);
    if (url.pathname === "/api/scripts/save" && req.method === "POST") return handleSaveScript(req);
    if (url.pathname === "/api/scripts/update" && req.method === "PUT") return handleUpdateScript(req);
    if (url.pathname === "/api/scripts/delete" && req.method === "DELETE") return handleDeleteScript(req);
    if (url.pathname === "/api/scripts/run" && req.method === "POST") return handleRunScript(req);
    if (url.pathname === "/api/reports" && req.method === "GET") return handleGetReports(url);
    if (url.pathname === "/api/status" && req.method === "GET") return handleGetStatus();
    if (url.pathname === "/api/capture" && req.method === "POST") return handleCapture(req);
    if (url.pathname === "/api/compare" && req.method === "POST") return handleCompare(req);
    if (url.pathname === "/api/report/index" && req.method === "POST") return handleReportIndex(req);
    if (url.pathname === "/api/report" && req.method === "POST") return handleReport(req);
    if (url.pathname === "/api/pipeline" && req.method === "POST") return handlePipeline(req);
    if (url.pathname === "/api/pipeline/stop" && req.method === "POST") return handlePipelineStop();
    if (url.pathname === "/api/progress" && req.method === "GET") return handleGetProgress(url);
    if (url.pathname === "/api/codegen" && req.method === "POST") return handleCodegen(req);
    if (url.pathname === "/api/codegen/stop" && req.method === "POST") return handleCodegenStop(req);
    if (url.pathname === "/api/compare/custom" && req.method === "POST") return handleCompareCustom(req);

    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      addClient(ws);
      ws.send(JSON.stringify({
        type: "connected",
        data: { version: projectConfig.version, isRunning, currentPhase },
        ts: Date.now(),
      }));
    },
    message(_ws, _message) {
      // Client messages not used yet — reserved for future interactive commands
    },
    close(ws) {
      removeClient(ws);
    },
  },
});

console.log(`\n  🚔 UI Police Dashboard`);
console.log(`  ${"-".repeat(40)}`);
console.log(`  Local:   http://localhost:${server.port}`);
console.log(`  Version: ${projectConfig.version}`);
console.log(`  Apps:    ${APP_LIST.join(", ")}`);
console.log(`  ${"-".repeat(40)}\n`);
