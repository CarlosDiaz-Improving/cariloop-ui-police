/**
 * Log stream — intercepts console output and fans out to WebSocket clients.
 *
 * When the web dashboard is active, all console.log / console.error output
 * is forwarded to connected WebSocket clients as JSON messages while still
 * printing to the real terminal.
 */

import type { ServerWebSocket } from "bun";

// Set of connected WebSocket clients
const clients = new Set<ServerWebSocket<unknown>>();

// Original console methods (saved before patching)
const _origLog = console.log;
const _origError = console.error;
const _origWarn = console.warn;

let intercepting = false;

// ============================================
// CLIENT MANAGEMENT
// ============================================

export function addClient(ws: ServerWebSocket<unknown>): void {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws);
}

export function getClientCount(): number {
  return clients.size;
}

// ============================================
// BROADCAST
// ============================================

function broadcast(type: string, data: unknown): void {
  if (clients.size === 0) return;
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  for (const ws of clients) {
    try {
      ws.send(msg);
    } catch {
      clients.delete(ws);
    }
  }
}

/** Send a log line to all connected clients */
export function broadcastLog(line: string): void {
  broadcast("log", line);
}

/** Send a status update to all connected clients */
export function broadcastStatus(status: {
  phase: string;
  app?: string;
  env?: string;
  progress?: number;
  detail?: string;
}): void {
  broadcast("status", status);
}

/** Send a completion event */
export function broadcastDone(result: {
  success: boolean;
  phase: string;
  detail?: string;
}): void {
  broadcast("done", result);
}

// ============================================
// CONSOLE INTERCEPTION
// ============================================

/**
 * Start intercepting console output and forwarding to WebSocket clients.
 * Original terminal output is preserved.
 */
export function startIntercepting(): void {
  if (intercepting) return;
  intercepting = true;

  console.log = (...args: unknown[]) => {
    _origLog(...args);
    const line = args.map(stringifyArg).join(" ");
    broadcastLog(line);
  };

  console.error = (...args: unknown[]) => {
    _origError(...args);
    const line = args.map(stringifyArg).join(" ");
    broadcastLog(`[ERROR] ${line}`);
  };

  console.warn = (...args: unknown[]) => {
    _origWarn(...args);
    const line = args.map(stringifyArg).join(" ");
    broadcastLog(`[WARN] ${line}`);
  };
}

/**
 * Stop intercepting — restore original console methods.
 */
export function stopIntercepting(): void {
  if (!intercepting) return;
  intercepting = false;
  console.log = _origLog;
  console.error = _origError;
  console.warn = _origWarn;
}

// ============================================
// HELPERS
// ============================================

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}
