/**
 * Path and filename utilities
 */

/**
 * Convert a page path to a screenshot filename
 * e.g., "/admin/dashboard" -> "admin-dashboard.png"
 */
export function pathToFilename(pagePath: string): string {
  return pagePath.replace(/^\//, "").replace(/\//g, "-") + ".png";
}

/**
 * Convert a page path and interaction ID to a filename
 * e.g., "/admin/users" + "add-user-button" -> "admin-users__add-user-button.png"
 */
export function interactionFilename(pagePath: string, interactionId: string): string {
  const base = pagePath.replace(/^\//, "").replace(/\//g, "-");
  return `${base}__${interactionId}.png`;
}

/**
 * Parse a filename back to page path and optional interaction ID
 */
export function parseFilename(filename: string): { pagePath: string; interactionId?: string } {
  const withoutExt = filename.replace(".png", "");
  
  if (withoutExt.includes("__")) {
    const [basePart, interactionPart] = withoutExt.split("__");
    return {
      pagePath: "/" + (basePart ?? "").replace(/-/g, "/"),
      interactionId: interactionPart,
    };
  }
  
  return {
    pagePath: "/" + withoutExt.replace(/-/g, "/"),
  };
}

/**
 * Sanitize a string for use in filenames
 */
export function sanitizeForFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
