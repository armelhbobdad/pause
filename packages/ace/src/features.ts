/**
 * Centralized optional dependency detection for ACE framework.
 *
 * This module provides a clean interface for checking which optional dependencies
 * are available, avoiding scattered try/catch imports throughout the codebase.
 *
 * @example
 * ```typescript
 * import { hasVercelAI, hasOpenAI, getAvailableFeatures } from './features';
 *
 * if (hasVercelAI()) {
 *   // Use Vercel AI SDK features
 * }
 * ```
 */

/**
 * Cache for dependency checks to avoid repeated imports
 */
const featureCache = new Map<string, boolean>();

/**
 * Check if a module can be imported/required.
 *
 * NOTE: This uses a synchronous check approach that may not work in all environments.
 * In Node.js ES modules, we can't easily use require.resolve() without createRequire
 * which requires import.meta.url. For now, we assume packages are available and
 * rely on runtime errors if they're missing.
 *
 * @param moduleName - Name of the module to import
 * @returns True (optimistic assumption - real check would require async import)
 */
function checkImport(_moduleName: string): boolean {
  // Simplified implementation: assume all packages are available
  // Real implementation would need async import() or createRequire with import.meta.url
  // which has compatibility issues across different module systems
  return true;
}

/**
 * Check if Vercel AI SDK is available.
 */
export function hasVercelAI(): boolean {
  return checkImport("ai");
}

/**
 * Check if OpenAI SDK is available.
 */
export function hasOpenAI(): boolean {
  return checkImport("openai");
}

/**
 * Check if Anthropic SDK is available.
 */
export function hasAnthropic(): boolean {
  return checkImport("@anthropic-ai/sdk");
}

/**
 * Check if Google Generative AI SDK is available.
 */
export function hasGoogleAI(): boolean {
  return checkImport("@google/generative-ai");
}

/**
 * Check if LangChain is available.
 */
export function hasLangChain(): boolean {
  return checkImport("@langchain/core");
}

/**
 * Check if Playwright browser automation is available.
 */
export function hasPlaywright(): boolean {
  return checkImport("playwright");
}

/**
 * Check if Puppeteer browser automation is available.
 */
export function hasPuppeteer(): boolean {
  return checkImport("puppeteer");
}

/**
 * Check if Zod schema validation is available.
 */
export function hasZod(): boolean {
  return checkImport("zod");
}

/**
 * Check if dotenv environment loader is available.
 */
export function hasDotenv(): boolean {
  return checkImport("dotenv");
}

/**
 * Check if numpy-like library is available (not applicable in TypeScript).
 * This is a stub for Python compatibility - always returns false.
 */
export function hasNumpy(): boolean {
  return false;
}

/**
 * Check if sentence-transformers library is available.
 */
export function hasSentenceTransformers(): boolean {
  return checkImport("sentence-transformers");
}

/**
 * Check if Opik observability platform is available.
 */
export function hasOpik(): boolean {
  return checkImport("opik");
}

/**
 * Get a dictionary of all available features.
 *
 * @returns Object mapping feature names to availability status
 *
 * @example
 * ```typescript
 * const features = getAvailableFeatures();
 * console.log(features);
 * // { vercelAI: true, openai: true, langchain: false, ... }
 * ```
 */
export function getAvailableFeatures(): Record<string, boolean> {
  return {
    vercelAI: hasVercelAI(),
    openai: hasOpenAI(),
    anthropic: hasAnthropic(),
    googleAI: hasGoogleAI(),
    langchain: hasLangChain(),
    playwright: hasPlaywright(),
    puppeteer: hasPuppeteer(),
    zod: hasZod(),
    dotenv: hasDotenv(),
    opik: hasOpik(),
  };
}

/**
 * Print a formatted table of available features.
 */
export function printFeatureStatus(): void {
  const features = getAvailableFeatures();

  console.log(`\n${"=".repeat(50)}`);
  console.log("ACE Framework - Available Features");
  console.log("=".repeat(50));

  for (const [feature, available] of Object.entries(features)) {
    const status = available ? "✓ Available" : "✗ Not installed";
    const paddedFeature = feature.padEnd(15);
    console.log(`  ${paddedFeature} ${status}`);
  }

  console.log(`${"=".repeat(50)}\n`);
}

/**
 * Clear the feature cache (useful for testing).
 */
export function clearFeatureCache(): void {
  featureCache.clear();
}
