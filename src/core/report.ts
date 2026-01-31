import fs from "fs";
import path from "path";
import type { ComparisonResult } from "./compare";
import { getReportsDir, getCurrentAppConfig, environments, APPS, APP_LIST, type AppConfig } from "./config";
import { log, style } from "../utils/terminal";

function imageToBase64(filepath: string): string {
  if (!fs.existsSync(filepath)) return "";
  const buffer = fs.readFileSync(filepath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function getBadgeClass(pct: number): string {
  if (pct < 1) return "badge-green";
  if (pct < 5) return "badge-yellow";
  return "badge-red";
}

interface GroupedResult {
  pagePath: string;
  base?: ComparisonResult;
  interactions: ComparisonResult[];
}

function groupResults(results: ComparisonResult[]): GroupedResult[] {
  const grouped = new Map<string, GroupedResult>();
  
  for (const r of results) {
    if (!grouped.has(r.pagePath)) {
      grouped.set(r.pagePath, { pagePath: r.pagePath, interactions: [] });
    }
    const group = grouped.get(r.pagePath)!;
    
    if (r.interactionId) {
      group.interactions.push(r);
    } else {
      group.base = r;
    }
  }
  
  // Sort by pagePath
  return Array.from(grouped.values()).sort((a, b) => 
    a.pagePath.localeCompare(b.pagePath)
  );
}

function renderCard(r: ComparisonResult, title: string, isInteraction: boolean = false, cardId: string = "", devBaseUrl: string = "", localBaseUrl: string = ""): string {
  const devB64 = imageToBase64(r.devScreenshot);
  const localB64 = imageToBase64(r.localScreenshot);
  const diffB64 = imageToBase64(r.diffScreenshot);
  const badgeClass = getBadgeClass(r.diffPercentage);
  const cardClass = isInteraction ? "card interaction-card" : "card";
  const headerClass = isInteraction ? "card-header interaction-header" : "card-header";
  
  const devFullUrl = devBaseUrl ? `${devBaseUrl}${r.pagePath}` : "";
  const localFullUrl = localBaseUrl ? `${localBaseUrl}${r.pagePath}` : "";

  return `
    <div class="${cardClass}" id="${cardId}">
      <div class="${headerClass}">
        <div class="card-title-group">
          <h2>${title}</h2>
          <div class="card-actions">
            ${devFullUrl ? `<a href="${devFullUrl}" target="_blank" rel="noopener noreferrer" class="card-action-btn develop" title="Open in Develop">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Develop</span>
            </a>` : ''}
            ${localFullUrl ? `<a href="${localFullUrl}" target="_blank" rel="noopener noreferrer" class="card-action-btn local" title="Open in Local">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Local</span>
            </a>` : ''}
          </div>
        </div>
        <span class="badge ${badgeClass}">${r.diffPercentage.toFixed(2)}% diff</span>
      </div>
      <div class="card-images">
        <div class="image-col">
          <h3>Develop</h3>
          <img src="${devB64}" alt="Develop screenshot" loading="lazy" onclick="openModal(this, 0)" />
        </div>
        <div class="image-col">
          <h3>Local</h3>
          <img src="${localB64}" alt="Local screenshot" loading="lazy" onclick="openModal(this, 1)" />
        </div>
        <div class="image-col">
          <h3>Diff</h3>
          <img src="${diffB64}" alt="Diff" loading="lazy" onclick="openModal(this, 2)" />
        </div>
      </div>
    </div>`;
}

export function generateReport(results: ComparisonResult[]): string {
  const reportsDir = getReportsDir();
  const appConfig = getCurrentAppConfig();
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  log.header("Generating Report");

  const grouped = groupResults(results);
  const baseResults = results.filter(r => !r.interactionId);
  const interactionResults = results.filter(r => r.interactionId);
  
  const totalPages = baseResults.length;
  const totalInteractions = interactionResults.length;
  const avgDiff =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.diffPercentage, 0) / results.length
      : 0;

  // Get environment URLs
  const devEnv = environments.find(e => e.name === "develop");
  const localEnv = environments.find(e => e.name === "local");
  const devUrl = devEnv?.baseUrl ?? "N/A";
  const localUrl = localEnv?.baseUrl ?? "N/A";

  // Generate navigation menu items for expanded sidebar
  const navItems = grouped.map((group, idx) => {
    const cardId = `page-${idx}`;
    const badgeClass = group.base ? getBadgeClass(group.base.diffPercentage) : "badge-green";
    const diffPct = group.base ? group.base.diffPercentage.toFixed(2) : "0.00";
    const interactionCount = group.interactions.length;
    
    return `
      <a href="#${cardId}" class="nav-item">
        <div class="nav-tooltip">
          <div class="nav-tooltip-path">${group.pagePath}</div>
          <div class="nav-tooltip-meta">
            <span>${diffPct}%</span>
            ${interactionCount > 0 ? `<span>• ${interactionCount} interactions</span>` : ''}
          </div>
        </div>
        <span class="nav-index">${idx + 1}</span>
        <span class="nav-path">${group.pagePath}</span>
        <div class="nav-meta">
          <span class="nav-badge ${badgeClass}">${diffPct}%</span>
          ${interactionCount > 0 ? `<span class="nav-interactions"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>${interactionCount}</span>` : ''}
        </div>
      </a>`;
  }).join("\n");

  const cards = grouped
    .map((group, idx) => {
      let html = "";
      const cardId = `page-${idx}`;
      
      // Base page card
      if (group.base) {
        html += renderCard(group.base, group.pagePath, false, cardId, devUrl, localUrl);
      }
      
      // Interaction cards (nested)
      if (group.interactions.length > 0) {
        html += `<div class="interactions-group">
          <div class="interactions-header">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            ${group.interactions.length} Interaction${group.interactions.length > 1 ? 's' : ''} Captured
          </div>`;
        
        for (const interaction of group.interactions) {
          const title = `${interaction.interactionId}`;
          const interactionCardId = `${cardId}-${interaction.interactionId?.replace(/\s+/g, '-')}`;
          html += renderCard(interaction, title, true, interactionCardId, devUrl, localUrl);
        }
        
        html += `</div>`;
      }
      
      return html;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appConfig.displayName} - Visual Regression Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    /* Theme Variables */
    :root {
      /* Light theme (default) */
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #f1f5f9;
      --bg-header: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --border-color: #e2e8f0;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --text-header: #ffffff;
      --card-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
      --hover-bg: #f1f5f9;
      --env-box-bg: rgba(255,255,255,0.15);
      --stat-bg: rgba(255,255,255,0.2);
      --scrollbar-track: #f1f5f9;
      --scrollbar-thumb: #cbd5e1;
      --topbar-bg: #ffffff;
      --topbar-border: #e2e8f0;
    }
    
    [data-theme="dark"] {
      --bg-primary: #0f0f14;
      --bg-secondary: #1a1a24;
      --bg-tertiary: #252535;
      --bg-header: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      --border-color: #2a2a3a;
      --text-primary: #e0e0e0;
      --text-secondary: #888888;
      --text-muted: #666666;
      --text-header: #ffffff;
      --card-shadow: 0 2px 8px rgba(0,0,0,0.3);
      --hover-bg: #252535;
      --env-box-bg: rgba(0,0,0,0.3);
      --stat-bg: rgba(255,255,255,0.08);
      --scrollbar-track: #1a1a24;
      --scrollbar-thumb: #333333;
      --topbar-bg: #1a1a24;
      --topbar-border: #2a2a3a;
    }
    
    body {
      font-family: "Google Sans", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      transition: background 0.3s, color 0.3s;
    }
    
    /* SVG Icons */
    .icon { width: 18px; height: 18px; vertical-align: middle; margin-right: 6px; }
    .icon-sm { width: 12px; height: 12px; vertical-align: middle; margin-right: 3px; }
    .icon-lg { width: 24px; height: 24px; }
    
    /* Top Bar */
    .topbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: var(--topbar-bg);
      border-bottom: 1px solid var(--topbar-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 100;
      transition: background 0.3s, border-color 0.3s;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .topbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .topbar-brand svg {
      width: 24px;
      height: 24px;
      color: #667eea;
    }
    .topbar-brand-text {
      font-size: 15px;
      font-weight: 700;
      color: #667eea;
      letter-spacing: -0.5px;
    }
    .topbar-divider {
      width: 1px;
      height: 24px;
      background: var(--border-color);
    }
    .topbar-project {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sidebar-toggle {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .sidebar-toggle:hover {
      border-color: #667eea;
      background: var(--hover-bg);
    }
    .sidebar-toggle svg {
      width: 18px;
      height: 18px;
      color: var(--text-secondary);
    }
    .theme-toggle {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .theme-toggle:hover {
      border-color: #667eea;
      background: var(--hover-bg);
    }
    .theme-toggle svg {
      width: 18px;
      height: 18px;
      color: var(--text-secondary);
    }
    
    /* Layout */
    .layout {
      display: grid;
      grid-template-columns: var(--sidebar-width, 280px) 1fr;
      min-height: 100vh;
      padding-top: 56px;
      transition: grid-template-columns 0.3s ease;
    }
    .layout.collapsed {
      --sidebar-width: 60px;
    }
    
    /* Sidebar Navigation */
    .sidebar {
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      height: calc(100vh - 56px);
      position: sticky;
      top: 56px;
      overflow-y: auto;
      overflow-x: hidden;
      transition: all 0.3s ease;
    }
    .sidebar-header {
      padding: 20px 16px;
      border-bottom: 1px solid var(--border-color);
    }
    .layout.collapsed .sidebar-header {
      padding: 20px 12px;
      text-align: center;
    }
    .sidebar-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sidebar-subtitle {
      font-size: 11px;
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .layout.collapsed .sidebar-title,
    .layout.collapsed .sidebar-subtitle {
      display: none;
    }
    .nav-section {
      padding: 12px 8px;
    }
    .nav-section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      padding: 8px;
      margin-bottom: 4px;
      white-space: nowrap;
    }
    .layout.collapsed .nav-section-title {
      text-align: center;
      padding: 8px 4px;
    }
    .layout.collapsed .nav-title-count {
      display: none;
    }
    .nav-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-radius: 8px;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 13px;
      transition: all 0.2s;
      margin-bottom: 2px;
      position: relative;
    }
    .nav-item:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }
    .nav-index {
      min-width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-tertiary);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-right: 10px;
      flex-shrink: 0;
    }
    .nav-path {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .nav-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      margin-left: 8px;
    }
    .nav-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .nav-interactions {
      font-size: 11px;
      color: #a78bfa;
      display: flex;
      align-items: center;
    }
    
    /* Collapsed sidebar styles */
    .layout.collapsed .nav-item {
      justify-content: center;
      padding: 10px 8px;
    }
    .layout.collapsed .nav-index {
      margin-right: 0;
    }
    .layout.collapsed .nav-path,
    .layout.collapsed .nav-meta {
      display: none;
    }
    
    /* Tooltip for collapsed sidebar */
    .nav-tooltip {
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px 14px;
      box-shadow: var(--card-shadow);
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s;
      z-index: 1000;
      min-width: 180px;
    }
    .layout.collapsed .nav-item:hover .nav-tooltip {
      opacity: 1;
      visibility: visible;
    }
    .nav-tooltip-path {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .nav-tooltip-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--text-secondary);
    }
    
    /* Main Content */
    .main-content {
      padding: 24px 32px;
    }
    
    /* Header */
    .header {
      background: var(--bg-header);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 32px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 40px;
    }
    .header-left {
      flex: 1;
    }
    .header-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-header);
      margin-bottom: 20px;
    }
    .header .summary {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .header .stat {
      background: var(--stat-bg);
      padding: 16px 24px;
      border-radius: 12px;
      min-width: 140px;
      backdrop-filter: blur(10px);
    }
    .stat-value { font-size: 32px; font-weight: bold; color: var(--text-header); }
    .stat-label { font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 4px; }
    .stat-interactions {
      background: rgba(255,255,255,0.25);
    }
    
    /* Environment URLs */
    .header-right {
      min-width: 340px;
    }
    .env-box {
      background: var(--env-box-bg);
      border-radius: 12px;
      padding: 20px;
      backdrop-filter: blur(10px);
    }
    .env-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255,255,255,0.7);
      margin-bottom: 16px;
    }
    .env-title svg {
      width: 16px;
      height: 16px;
    }
    .env-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.15);
    }
    .env-row:last-child {
      border-bottom: none;
    }
    .env-label {
      font-size: 12px;
      font-weight: 700;
      width: 75px;
      padding: 4px 8px;
      border-radius: 4px;
      text-align: center;
      flex-shrink: 0;
    }
    .env-label.develop { background: rgba(74, 222, 128, 0.3); color: #4ade80; }
    .env-label.local { background: rgba(249, 115, 22, 0.3); color: #fb923c; }
    .env-url {
      font-size: 13px;
      color: rgba(255,255,255,0.9);
      word-break: break-all;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      text-decoration: none;
      transition: color 0.2s;
    }
    .env-url:hover {
      color: #fff;
      text-decoration: underline;
    }
    
    /* Cards */
    .card {
      background: var(--bg-secondary);
      border-radius: 16px;
      margin-bottom: 24px;
      overflow: hidden;
      border: 1px solid var(--border-color);
      scroll-margin-top: 80px;
      box-shadow: var(--card-shadow);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-tertiary);
    }
    .card-header h2 { 
      font-size: 16px; 
      font-weight: 600;
      color: var(--text-primary);
    }
    .card-title-group {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .card-actions {
      display: flex;
      gap: 8px;
    }
    .card-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    .card-action-btn svg {
      width: 14px;
      height: 14px;
    }
    .card-action-btn.develop {
      color: #22c55e;
      background: rgba(74, 222, 128, 0.1);
      border-color: rgba(74, 222, 128, 0.3);
    }
    .card-action-btn.develop:hover {
      background: rgba(74, 222, 128, 0.2);
      border-color: #22c55e;
    }
    .card-action-btn.local {
      color: #f97316;
      background: rgba(249, 115, 22, 0.1);
      border-color: rgba(249, 115, 22, 0.3);
    }
    .card-action-btn.local:hover {
      background: rgba(249, 115, 22, 0.2);
      border-color: #f97316;
    }
    [data-theme="dark"] .card-action-btn.develop {
      background: rgba(74, 222, 128, 0.15);
    }
    [data-theme="dark"] .card-action-btn.local {
      background: rgba(249, 115, 22, 0.15);
    }
    .badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-green { background: rgba(74, 222, 128, 0.15); color: #22c55e; }
    .badge-yellow { background: rgba(250, 204, 21, 0.15); color: #ca8a04; }
    .badge-red { background: rgba(248, 113, 113, 0.15); color: #dc2626; }
    [data-theme="dark"] .badge-green { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
    [data-theme="dark"] .badge-yellow { background: rgba(250, 204, 21, 0.2); color: #facc15; }
    [data-theme="dark"] .badge-red { background: rgba(248, 113, 113, 0.2); color: #f87171; }
    .card-images {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      padding: 24px;
    }
    .image-col h3 {
      text-align: center;
      margin-bottom: 12px;
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .image-col img {
      width: 100%;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .image-col img:hover {
      border-color: #667eea;
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
    }
    
    /* Interaction styles */
    .interactions-group {
      margin-left: 40px;
      margin-bottom: 24px;
      border-left: 3px solid #667eea;
      padding-left: 20px;
    }
    .interactions-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 18px;
      border-radius: 10px;
      margin-bottom: 16px;
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
    }
    .interactions-header svg {
      margin-right: 10px;
    }
    .interaction-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
    }
    .interaction-header {
      background: var(--bg-tertiary);
    }
    .interaction-header h2 {
      font-size: 14px;
      color: var(--text-secondary);
    }
    .interaction-header h2::before {
      content: "↳ ";
      color: #667eea;
    }
    
    /* Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.95);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }
    .modal.active {
      display: flex;
    }
    .modal-close {
      position: absolute;
      top: 20px;
      right: 24px;
      background: rgba(255,255,255,0.1);
      border: none;
      color: #fff;
      font-size: 32px;
      cursor: pointer;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      z-index: 1001;
    }
    .modal-close:hover {
      background: rgba(255,255,255,0.2);
    }
    .modal-content {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 60px;
    }
    .modal-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255,255,255,0.1);
      border: none;
      color: #fff;
      font-size: 28px;
      cursor: pointer;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .modal-nav:hover {
      background: rgba(255,255,255,0.2);
    }
    .modal-nav.prev { left: 24px; }
    .modal-nav.next { right: 24px; }
    .modal-image-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: calc(100% - 160px);
      max-height: calc(100% - 80px);
    }
    .modal-label {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 16px;
      padding: 8px 20px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
    }
    .modal-label.dev { color: #4ade80; }
    .modal-label.local { color: #f97316; }
    .modal-label.diff { color: #a78bfa; }
    .modal-image {
      max-width: 100%;
      max-height: calc(100vh - 160px);
      object-fit: contain;
      border-radius: 8px;
    }
    .modal-dots {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
    }
    .modal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      cursor: pointer;
      transition: all 0.2s;
    }
    .modal-dot.active {
      background: #667eea;
      transform: scale(1.2);
    }
    .modal-dot:hover {
      background: rgba(255,255,255,0.5);
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--scrollbar-track); }
    ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
  </style>
</head>
<body>
  <!-- Top Bar -->
  <header class="topbar">
    <div class="topbar-left">
      <div class="topbar-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <span class="topbar-brand-text">Cariloop UI Police</span>
      </div>
      <div class="topbar-divider"></div>
      <span class="topbar-project">${appConfig.displayName}</span>
    </div>
    <div class="topbar-right">
      <button class="sidebar-toggle" onclick="toggleSidebar()" title="Toggle sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18"/>
        </svg>
      </button>
      <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        <svg class="icon-moon" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
    </div>
  </header>

  <div class="layout" id="layout">
    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">${appConfig.displayName}</div>
        <div class="sidebar-subtitle">Visual Regression Report</div>
      </div>
      <nav class="nav-section">
        <div class="nav-section-title"><span class="nav-title-text">Pages</span><span class="nav-title-count"> (${totalPages})</span></div>
        ${navItems}
      </nav>
    </aside>
    
    <!-- Main Content -->
    <main class="main-content">
      <div class="header">
        <div class="header-left">
          <h1 class="header-title">${appConfig.displayName}</h1>
          <div class="summary">
            <div class="stat">
              <div class="stat-value">${totalPages}</div>
              <div class="stat-label">Pages Compared</div>
            </div>
            <div class="stat stat-interactions">
              <div class="stat-value">${totalInteractions}</div>
              <div class="stat-label">Interactions Captured</div>
            </div>
            <div class="stat">
              <div class="stat-value">${avgDiff.toFixed(2)}%</div>
              <div class="stat-label">Avg Difference</div>
            </div>
          </div>
        </div>
        <div class="header-right">
          <div class="env-box">
            <div class="env-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Comparing Environments
            </div>
            <div class="env-row">
              <span class="env-label develop">DEVELOP</span>
              <a href="${devUrl}" target="_blank" rel="noopener noreferrer" class="env-url">${devUrl}</a>
            </div>
            <div class="env-row">
              <span class="env-label local">LOCAL</span>
              <a href="${localUrl}" target="_blank" rel="noopener noreferrer" class="env-url">${localUrl}</a>
            </div>
          </div>
        </div>
      </div>
      
      ${cards}
    </main>
  </div>
  
  <!-- Image Modal -->
  <div class="modal" id="imageModal">
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <button class="modal-nav prev" onclick="navigateModal(-1)">&#8249;</button>
    <div class="modal-content">
      <div class="modal-image-container">
        <div class="modal-label" id="modalLabel">Dev</div>
        <img class="modal-image" id="modalImage" src="" alt="Full size preview" />
      </div>
    </div>
    <button class="modal-nav next" onclick="navigateModal(1)">&#8250;</button>
    <div class="modal-dots">
      <div class="modal-dot" data-index="0" onclick="goToImage(0)"></div>
      <div class="modal-dot" data-index="1" onclick="goToImage(1)"></div>
      <div class="modal-dot" data-index="2" onclick="goToImage(2)"></div>
    </div>
  </div>
  
  <script>
    // Sidebar toggle
    function toggleSidebar() {
      const layout = document.getElementById('layout');
      layout.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', layout.classList.contains('collapsed'));
    }
    
    // Load saved sidebar state
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      document.getElementById('layout').classList.add('collapsed');
    }
  
    // Theme toggle
    function toggleTheme() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeToggle(newTheme);
    }
    
    function updateThemeToggle(theme) {
      const sunIcon = document.querySelector('.icon-sun');
      const moonIcon = document.querySelector('.icon-moon');
      
      if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      }
    }
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggle(savedTheme);
  
    // Modal functionality
    let currentImages = [];
    let currentIndex = 0;
    const labels = ['Dev', 'Local', 'Diff'];
    const labelClasses = ['dev', 'local', 'diff'];
    
    function openModal(imgElement, index) {
      const container = imgElement.closest('.card-images');
      const images = container.querySelectorAll('img');
      currentImages = Array.from(images).map(img => img.src);
      currentIndex = index;
      updateModal();
      document.getElementById('imageModal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    
    function closeModal() {
      document.getElementById('imageModal').classList.remove('active');
      document.body.style.overflow = '';
    }
    
    function navigateModal(direction) {
      currentIndex = (currentIndex + direction + 3) % 3;
      updateModal();
    }
    
    function goToImage(index) {
      currentIndex = index;
      updateModal();
    }
    
    function updateModal() {
      const modalImage = document.getElementById('modalImage');
      const modalLabel = document.getElementById('modalLabel');
      modalImage.src = currentImages[currentIndex];
      modalLabel.textContent = labels[currentIndex];
      modalLabel.className = 'modal-label ' + labelClasses[currentIndex];
      
      document.querySelectorAll('.modal-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentIndex);
      });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('imageModal');
      if (!modal.classList.contains('active')) return;
      
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') navigateModal(-1);
      if (e.key === 'ArrowRight') navigateModal(1);
    });
    
    // Click outside to close
    document.getElementById('imageModal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal') || e.target.classList.contains('modal-content')) {
        closeModal();
      }
    });
  </script>
</body>
</html>`;

  const outputPath = path.join(reportsDir, "index.html");
  fs.writeFileSync(outputPath, html, "utf-8");
  
  log.fileSaved(outputPath, "Report");
  console.log(`  ${style.muted(`Pages: ${totalPages} | Interactions: ${totalInteractions} | Avg Diff: ${avgDiff.toFixed(2)}%`)}\n`);
  
  return outputPath;
}

/**
 * Generate main index page showing all available app reports
 */
export function generateMainIndex(): string {
  const reportsBaseDir = "reports";
  
  if (!fs.existsSync(reportsBaseDir)) {
    fs.mkdirSync(reportsBaseDir, { recursive: true });
  }
  
  log.header("Generating Main Index");
  
  // Scan for available reports
  interface AppReport {
    appType: string;
    config: AppConfig;
    reportPath: string;
    hasReport: boolean;
    lastModified?: Date;
    stats?: {
      pages: number;
      size: string;
    };
  }
  
  const appReports: AppReport[] = APP_LIST.map(appType => {
    const config = APPS[appType];
    const reportDir = path.join(reportsBaseDir, `cariloop-${appType}`);
    const reportPath = path.join(reportDir, "index.html");
    const hasReport = fs.existsSync(reportPath);
    
    let lastModified: Date | undefined;
    let stats: { pages: number; size: string } | undefined;
    
    if (hasReport) {
      const stat = fs.statSync(reportPath);
      lastModified = stat.mtime;
      stats = {
        pages: 0,
        size: formatBytes(stat.size),
      };
      
      // Count screenshots to estimate pages
      const screenshotsDir = path.join("screenshots", `cariloop-${appType}`, "develop");
      if (fs.existsSync(screenshotsDir)) {
        const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith(".png") && !f.includes("__"));
        stats.pages = files.length;
      }
    }
    
    return {
      appType,
      config,
      reportPath: `cariloop-${appType}/index.html`,
      hasReport,
      lastModified,
      stats,
    };
  });
  
  const availableReports = appReports.filter(r => r.hasReport);
  const generatedAt = new Date().toLocaleString();
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cariloop UI Police - Reports Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #f1f5f9;
      --border-color: #e2e8f0;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --card-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
      --hover-shadow: 0 10px 40px rgba(102, 126, 234, 0.15);
    }
    
    [data-theme="dark"] {
      --bg-primary: #0f0f14;
      --bg-secondary: #1a1a24;
      --bg-tertiary: #252535;
      --border-color: #2a2a3a;
      --text-primary: #e0e0e0;
      --text-secondary: #888888;
      --text-muted: #666666;
      --card-shadow: 0 2px 8px rgba(0,0,0,0.3);
      --hover-shadow: 0 10px 40px rgba(102, 126, 234, 0.25);
    }
    
    body {
      font-family: "Google Sans", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      transition: background 0.3s, color 0.3s;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: 48px;
    }
    .header-brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .header-brand svg {
      width: 48px;
      height: 48px;
      color: #667eea;
    }
    .header-title {
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header-subtitle {
      font-size: 16px;
      color: var(--text-secondary);
      margin-bottom: 24px;
    }
    .header-stats {
      display: flex;
      justify-content: center;
      gap: 32px;
    }
    .header-stat {
      text-align: center;
    }
    .header-stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #667eea;
    }
    .header-stat-label {
      font-size: 13px;
      color: var(--text-muted);
    }
    
    /* Theme Toggle */
    .theme-toggle {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: var(--card-shadow);
    }
    .theme-toggle:hover {
      border-color: #667eea;
    }
    .theme-toggle svg {
      width: 20px;
      height: 20px;
      color: var(--text-secondary);
    }
    
    /* Apps Grid */
    .apps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }
    
    /* App Card */
    .app-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s ease;
      text-decoration: none;
      display: block;
      box-shadow: var(--card-shadow);
    }
    .app-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--hover-shadow);
      border-color: #667eea;
    }
    .app-card.disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .app-card-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px;
      position: relative;
    }
    .app-card-icon {
      width: 48px;
      height: 48px;
      background: rgba(255,255,255,0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }
    .app-card-icon svg {
      width: 24px;
      height: 24px;
      color: white;
    }
    .app-card-name {
      font-size: 20px;
      font-weight: 700;
      color: white;
      margin-bottom: 4px;
    }
    .app-card-folder {
      font-size: 13px;
      color: rgba(255,255,255,0.7);
      font-family: 'SF Mono', Monaco, monospace;
    }
    .app-card-status {
      position: absolute;
      top: 16px;
      right: 16px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .app-card-status.available {
      background: rgba(74, 222, 128, 0.3);
      color: #4ade80;
    }
    .app-card-status.pending {
      background: rgba(148, 163, 184, 0.3);
      color: rgba(255,255,255,0.7);
    }
    .app-card-body {
      padding: 20px 24px;
    }
    .app-card-stats {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
    }
    .app-stat {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .app-stat svg {
      width: 16px;
      height: 16px;
      color: var(--text-muted);
    }
    .app-stat-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .app-stat-label {
      font-size: 12px;
      color: var(--text-muted);
    }
    .app-card-meta {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .app-card-meta svg {
      width: 14px;
      height: 14px;
    }
    .app-card-action {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .app-card-action-text {
      font-size: 13px;
      font-weight: 500;
      color: #667eea;
    }
    .app-card-action svg {
      width: 16px;
      height: 16px;
      color: #667eea;
      transition: transform 0.2s;
    }
    .app-card:hover .app-card-action svg {
      transform: translateX(4px);
    }
    
    /* Footer */
    .footer {
      text-align: center;
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
      font-size: 13px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
    <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
    <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>
  
  <div class="container">
    <header class="header">
      <div class="header-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <h1 class="header-title">Cariloop UI Police</h1>
      </div>
      <p class="header-subtitle">Visual Regression Testing Dashboard</p>
      <div class="header-stats">
        <div class="header-stat">
          <div class="header-stat-value">${availableReports.length}</div>
          <div class="header-stat-label">Reports Available</div>
        </div>
        <div class="header-stat">
          <div class="header-stat-value">${APP_LIST.length}</div>
          <div class="header-stat-label">Total Apps</div>
        </div>
      </div>
    </header>
    
    <div class="apps-grid">
      ${appReports.map(app => {
        const iconSvg = getAppIcon(app.appType);
        if (app.hasReport) {
          return `
          <a href="${app.reportPath}" class="app-card">
            <div class="app-card-header">
              <span class="app-card-status available">Available</span>
              <div class="app-card-icon">${iconSvg}</div>
              <div class="app-card-name">${app.config.displayName}</div>
              <div class="app-card-folder">cariloop-${app.appType}</div>
            </div>
            <div class="app-card-body">
              <div class="app-card-stats">
                <div class="app-stat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                  <span class="app-stat-value">${app.stats?.pages ?? 0}</span>
                  <span class="app-stat-label">pages</span>
                </div>
                <div class="app-stat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span class="app-stat-value">${app.stats?.size ?? '0 B'}</span>
                  <span class="app-stat-label">size</span>
                </div>
              </div>
              <div class="app-card-meta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${app.lastModified ? `Updated ${formatTimeAgo(app.lastModified)}` : 'Unknown'}
              </div>
              <div class="app-card-action">
                <span class="app-card-action-text">View Report</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
            </div>
          </a>`;
        } else {
          return `
          <div class="app-card disabled">
            <div class="app-card-header">
              <span class="app-card-status pending">No Report</span>
              <div class="app-card-icon">${iconSvg}</div>
              <div class="app-card-name">${app.config.displayName}</div>
              <div class="app-card-folder">cariloop-${app.appType}</div>
            </div>
            <div class="app-card-body">
              <div class="app-card-meta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Run tests to generate report
              </div>
            </div>
          </div>`;
        }
      }).join('')}
    </div>
    
    <footer class="footer">
      Generated on ${generatedAt} • Cariloop UI Police v1.0
    </footer>
  </div>
  
  <script>
    // Theme management
    function initTheme() {
      const saved = localStorage.getItem('theme');
      if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon(saved);
      }
    }
    
    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeIcon(next);
    }
    
    function updateThemeIcon(theme) {
      const sunIcon = document.querySelector('.sun-icon');
      const moonIcon = document.querySelector('.moon-icon');
      if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      }
    }
    
    initTheme();
  </script>
</body>
</html>`;

  const outputPath = path.join(reportsBaseDir, "index.html");
  fs.writeFileSync(outputPath, html, "utf-8");
  
  log.fileSaved(outputPath, "Main Index");
  console.log(`  ${style.muted(`Available Reports: ${availableReports.length}/${APP_LIST.length}`)}\n`);
  
  return outputPath;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}

function getAppIcon(appType: string): string {
  const icons: Record<string, string> = {
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    coach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    auth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  };
  return icons[appType] ?? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
}

// Allow running standalone
if (import.meta.main) {
  const { compareScreenshots } = await import("./compare");
  const { getScreenshotsDir } = await import("./config");
  
  const screenshotsDevDir = path.join(getScreenshotsDir(), "dev");
  if (!fs.existsSync(screenshotsDevDir)) {
    log.error("No screenshots found. Run capture and compare first.");
    process.exit(1);
  }
  const files = fs.readdirSync(screenshotsDevDir).filter((f) => f.endsWith(".png"));
  const pages = files
    .filter((f) => !f.includes("__"))
    .map((f) => "/" + f.replace(".png", "").replace(/-/g, "/"));
  const results = compareScreenshots(pages);
  generateReport(results);
}
