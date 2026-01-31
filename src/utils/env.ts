/**
 * Environment variable utilities
 */

const env = Bun.env;

export function requireEnv(key: string): string {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

export function optionalEnv(key: string): string | undefined {
  const value = env[key];
  return value?.trim() || undefined;
}

export function requireNumber(key: string): number {
  const value = requireEnv(key);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

export function optionalNumber(key: string, defaultValue: number): number {
  const value = optionalEnv(key);
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return parsed;
}

export function optionalBoolean(key: string, defaultValue = false): boolean {
  const value = optionalEnv(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === "true";
}
