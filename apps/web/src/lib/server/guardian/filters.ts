import "server-only";

/**
 * Banned terminology guardrail — runtime safety net for NFR-T5.
 *
 * The system prompts already instruct the LLM not to use these terms.
 * This filter catches violations the LLM may still produce.
 */

export const BANNED_TERMS_MAP: Record<string, string | null> = {
  // Multi-word phrases (matched FIRST to avoid partial hits)
  "bad habit": null,
  "impulse control": null,
  "you should": "have you considered",
  "you need to": "what if",

  // Clinical terms (epic stories AC replacements)
  addiction: "pattern",
  compulsive: "frequent",
  compulsion: "urge",
  disorder: null,
  therapy: "support",
  treatment: null,
  diagnosis: null,
  anxiety: "impulse",

  // Judgmental terms — neutral replacements to avoid mangling common phrases
  problem: "situation",
  issue: "concern",
  unhealthy: null,

  // Medical terms
  symptoms: null,
  condition: "situation",
  intervention: null,
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface CompiledPattern {
  regex: RegExp;
  replacement: string | null;
  original: string;
}

// Pre-compile regex patterns at module level (AC5: <10ms per chunk).
// Sort by descending term length so multi-word phrases match first.
const COMPILED_PATTERNS: CompiledPattern[] = Object.entries(BANNED_TERMS_MAP)
  .sort(([a], [b]) => b.length - a.length)
  .map(([term, replacement]) => ({
    regex: new RegExp(`\\b${escapeRegex(term)}\\b`, "gi"),
    replacement,
    original: term,
  }));

interface Replacement {
  original: string;
  replacement: string | null;
}

interface FilterResult {
  filtered: string;
  replacements: Replacement[];
}

function applyCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function filterBannedTerms(text: string): FilterResult {
  const replacements: Replacement[] = [];
  let filtered = text;

  for (const pattern of COMPILED_PATTERNS) {
    // Reset lastIndex for global regex reuse
    pattern.regex.lastIndex = 0;
    filtered = filtered.replace(pattern.regex, (match) => {
      replacements.push({
        original: match,
        replacement: pattern.replacement,
      });
      if (pattern.replacement === null) {
        return "";
      }
      return applyCase(match, pattern.replacement);
    });
  }

  // Normalize whitespace after null removals: collapse multiple spaces.
  // Do NOT trim() — in streaming context, leading/trailing spaces are meaningful
  // for chunk continuity (previous chunk may end with a word expecting a space).
  if (replacements.some((r) => r.replacement === null)) {
    filtered = filtered.replace(/ {2,}/g, " ");
  }

  return { filtered, replacements };
}

export function createBannedTermFilter(
  onReplacements: (replacements: Replacement[]) => void
) {
  return () => {
    const allReplacements: Replacement[] = [];
    return new TransformStream({
      transform(chunk, controller) {
        if (chunk.type === "text-delta") {
          const { filtered, replacements } = filterBannedTerms(chunk.text);
          if (replacements.length > 0) {
            allReplacements.push(...replacements);
          }
          controller.enqueue({ ...chunk, text: filtered });
        } else {
          controller.enqueue(chunk);
        }
      },
      flush() {
        if (allReplacements.length > 0) {
          onReplacements(allReplacements);
        }
      },
    });
  };
}
