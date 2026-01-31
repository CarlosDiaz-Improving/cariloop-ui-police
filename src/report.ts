import fs from "fs";
import path from "path";
import type { ComparisonResult } from "./compare";
import { getReportsDir, getCurrentAppConfig } from "./config";

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

function renderCard(r: ComparisonResult, title: string, isInteraction: boolean = false): string {
  const devB64 = imageToBase64(r.devScreenshot);
  const localB64 = imageToBase64(r.localScreenshot);
  const diffB64 = imageToBase64(r.diffScreenshot);
  const badgeClass = getBadgeClass(r.diffPercentage);
  const cardClass = isInteraction ? "card interaction-card" : "card";
  const headerClass = isInteraction ? "card-header interaction-header" : "card-header";

  return `
    <div class="${cardClass}">
      <div class="${headerClass}">
        <h2>${title}</h2>
        <span class="badge ${badgeClass}">${r.diffPercentage.toFixed(2)}% diff</span>
      </div>
      <div class="card-images">
        <div class="image-col">
          <h3>Dev</h3>
          <img src="${devB64}" alt="Dev screenshot" loading="lazy" />
        </div>
        <div class="image-col">
          <h3>Local</h3>
          <img src="${localB64}" alt="Local screenshot" loading="lazy" />
        </div>
        <div class="image-col">
          <h3>Diff</h3>
          <img src="${diffB64}" alt="Diff" loading="lazy" />
        </div>
      </div>
    </div>`;
}

export function generateReport(results: ComparisonResult[]): string {
  const reportsDir = getReportsDir();
  const appConfig = getCurrentAppConfig();
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const grouped = groupResults(results);
  const baseResults = results.filter(r => !r.interactionId);
  const interactionResults = results.filter(r => r.interactionId);
  
  const totalPages = baseResults.length;
  const totalInteractions = interactionResults.length;
  const avgDiff =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.diffPercentage, 0) / results.length
      : 0;

  const cards = grouped
    .map((group) => {
      let html = "";
      
      // Base page card
      if (group.base) {
        html += renderCard(group.base, group.pagePath, false);
      }
      
      // Interaction cards (nested)
      if (group.interactions.length > 0) {
        html += `<div class="interactions-group">
          <div class="interactions-header">
            <span class="interactions-icon">⚡</span>
            ${group.interactions.length} Interaction${group.interactions.length > 1 ? 's' : ''} Captured
          </div>`;
        
        for (const interaction of group.interactions) {
          const title = `${interaction.interactionId}`;
          html += renderCard(interaction, title, true);
        }
        
        html += `</div>`;
      }
      
      return html;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appConfig.displayName} - Visual Regression Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 20px;
    }
    .header {
      background: #1a1a2e;
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header .summary {
      display: flex;
      gap: 30px;
      margin-top: 15px;
      flex-wrap: wrap;
    }
    .header .stat {
      background: rgba(255,255,255,0.1);
      padding: 10px 20px;
      border-radius: 8px;
    }
    .stat-value { font-size: 28px; font-weight: bold; }
    .stat-label { font-size: 13px; opacity: 0.8; }
    .card {
      background: white;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #eee;
    }
    .card-header h2 { font-size: 18px; }
    .badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }
    .badge-green { background: #d4edda; color: #155724; }
    .badge-yellow { background: #fff3cd; color: #856404; }
    .badge-red { background: #f8d7da; color: #721c24; }
    .card-images {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      padding: 20px;
    }
    .image-col h3 {
      text-align: center;
      margin-bottom: 8px;
      font-size: 14px;
      color: #666;
    }
    .image-col img {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 6px;
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
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-weight: 600;
      font-size: 14px;
    }
    .interactions-icon {
      margin-right: 8px;
    }
    .interaction-card {
      background: #fafafa;
      border: 1px solid #e0e0e0;
    }
    .interaction-header {
      background: #f5f5f5;
    }
    .interaction-header h2 {
      font-size: 15px;
      color: #555;
    }
    .interaction-header h2::before {
      content: "↳ ";
      color: #667eea;
    }
    
    /* Stats for interactions */
    .stat-interactions {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${appConfig.displayName} - Visual Regression Report</h1>
    <p>Comparing <strong>dev</strong> vs <strong>local</strong></p>
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
  ${cards}
</body>
</html>`;

  const outputPath = path.join(reportsDir, "index.html");
  fs.writeFileSync(outputPath, html, "utf-8");
  console.log(`Report generated: ${outputPath}`);
  return outputPath;
}

// Allow running standalone
if (import.meta.main) {
  const { compareScreenshots } = await import("./compare");
  const screenshotsDevDir = path.join("screenshots", "dev");
  if (!fs.existsSync(screenshotsDevDir)) {
    console.error("No screenshots found. Run capture and compare first.");
    process.exit(1);
  }
  const files = fs.readdirSync(screenshotsDevDir).filter((f) => f.endsWith(".png"));
  const pages = files.map((f) => "/" + f.replace(".png", "").replace(/-/g, "/"));
  const results = compareScreenshots(pages);
  generateReport(results);
}
