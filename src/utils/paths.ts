/**
 * Path and filename utilities
 *
 * Naming convention (filenames only — app/env/run encoded in directory):
 *   Base page:    {page-slug}.png
 *   Interaction:  {page-slug}__{interaction-id}.png
 *
 * Examples:
 *   captures/auth/260217-001/develop/login.png
 *   captures/admin/260217-001/develop/admin-users__add-user-button.png
 */

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

/**
 * Convert a page path to the slug portion of a filename
 * e.g., "/admin/dashboard" -> "admin-dashboard"
 *        "/login"          -> "login"
 */
export function pageSlug(pagePath: string): string {
  const clean = pagePath.split("?")[0] ?? pagePath;
  return clean.replace(/^\//, "").replace(/\//g, "-") || "root";
}

/**
 * Build the screenshot filename for a base page
 * e.g., "/admin/dashboard" -> "admin-dashboard.png"
 *        "/login"          -> "login.png"
 */
export function pathToFilename(pagePath: string): string {
  return `${pageSlug(pagePath)}.png`;
}

/**
 * Build the screenshot filename for an interaction
 * e.g., ("/admin/users", "add-user-button") -> "admin-users__add-user-button.png"
 */
export function interactionFilename(
  pagePath: string,
  interactionId: string,
): string {
  return `${pageSlug(pagePath)}__${interactionId}.png`;
}

/**
 * Parse a filename back to its components
 */
export function parseFilename(filename: string): {
  pagePath: string;
  interactionId?: string;
} {
  const withoutExt = filename.replace(/\.png$/, "");

  let basePart = withoutExt;
  let interactionId: string | undefined;
  if (withoutExt.includes("__")) {
    const idx = withoutExt.indexOf("__");
    basePart = withoutExt.substring(0, idx);
    interactionId = withoutExt.substring(idx + 2);
  }

  // Convert slug back to a path: "admin-dashboard" -> "/admin/dashboard"
  const pagePath = "/" + basePart.replace(/-/g, "/");

  return { pagePath, interactionId };
}
