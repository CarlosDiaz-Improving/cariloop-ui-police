import fs from "fs";
import path from "path";
import type { ComparisonResult } from "./compare";
import { reportsDir } from "./config";

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

export function generateReport(results: ComparisonResult[]): string {
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const totalPages = results.length;
  const avgDiff =
    totalPages > 0
      ? results.reduce((sum, r) => sum + r.diffPercentage, 0) / totalPages
      : 0;

  const cards = results
    .map((r) => {
      const devB64 = imageToBase64(r.devScreenshot);
      const localB64 = imageToBase64(r.localScreenshot);
      const diffB64 = imageToBase64(r.diffScreenshot);
      const badgeClass = getBadgeClass(r.diffPercentage);

      return `
      <div class="card">
        <div class="card-header">
          <h2>${r.pagePath}</h2>
          <span class="badge ${badgeClass}">${r.diffPercentage.toFixed(2)}% diff</span>
        </div>
        <div class="card-images">
          <div class="image-col">
            <h3>Dev</h3>
            <img src="${devB64}" alt="Dev screenshot" />
          </div>
          <div class="image-col">
            <h3>Local</h3>
            <img src="${localB64}" alt="Local screenshot" />
          </div>
          <div class="image-col">
            <h3>Diff</h3>
            <img src="${diffB64}" alt="Diff" />
          </div>
        </div>
      </div>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cariloop UI Police - Visual Regression Report</title>
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
  </style>
</head>
<body>
  <div class="header">
    <h1>Cariloop UI Police - Visual Regression Report</h1>
    <p>Comparing <strong>dev-plan</strong> vs <strong>local-plan</strong></p>
    <div class="summary">
      <div class="stat">
        <div class="stat-value">${totalPages}</div>
        <div class="stat-label">Pages Compared</div>
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
