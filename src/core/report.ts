import fs from "fs";
import path from "path";
import type { ComparisonResult } from "./compare";
import { getReportsDir, getCurrentAppConfig, environments } from "./config";
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

function renderCard(r: ComparisonResult, title: string, isInteraction: boolean = false, cardId: string = ""): string {
  const devB64 = imageToBase64(r.devScreenshot);
  const localB64 = imageToBase64(r.localScreenshot);
  const diffB64 = imageToBase64(r.diffScreenshot);
  const badgeClass = getBadgeClass(r.diffPercentage);
  const cardClass = isInteraction ? "card interaction-card" : "card";
  const headerClass = isInteraction ? "card-header interaction-header" : "card-header";

  return `
    <div class="${cardClass}" id="${cardId}">
      <div class="${headerClass}">
        <h2>${title}</h2>
        <span class="badge ${badgeClass}">${r.diffPercentage.toFixed(2)}% diff</span>
      </div>
      <div class="card-images">
        <div class="image-col">
          <h3>Dev</h3>
          <img src="${devB64}" alt="Dev screenshot" loading="lazy" onclick="openModal(this, 0)" />
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
  const devEnv = environments.find(e => e.name === "dev");
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
        html += renderCard(group.base, group.pagePath, false, cardId);
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
          html += renderCard(interaction, title, true, interactionCardId);
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      width: 50px;
      padding: 4px 8px;
      border-radius: 4px;
      text-align: center;
    }
    .env-label.dev { background: rgba(74, 222, 128, 0.3); color: #4ade80; }
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
        <div class="nav-section-title">Pages (${totalPages})</div>
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
              <span class="env-label dev">DEV</span>
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
