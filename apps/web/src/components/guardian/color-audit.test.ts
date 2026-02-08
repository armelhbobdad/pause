import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HARDCODED_HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const HARDCODED_RGB_PATTERN = /\brgba?\([^)]*\)/g;
const HARDCODED_HSL_PATTERN = /\bhsla?\([^)]*\)/g;
const HSL_VAR_PATTERN = /hsla?\(var\(--/;
const RGB_VAR_PATTERN = /rgba?\(var\(--/;

/** Files and directories to exclude from the audit */
const EXCLUDE_PATTERNS = [
  "ui/", // shadcn primitives
  ".test.", // test files
  "tokens.css", // token definitions
  "index.css", // global CSS
  "native-badge-carbon.tsx", // uitripled vendored component
];

function getComponentFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        const relativePath = path.relative(dir, fullPath);
        const excluded = EXCLUDE_PATTERNS.some((p) => relativePath.includes(p));
        if (!excluded) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

function isInVarFallback(line: string, match: string): boolean {
  // Check if the color is used as a fallback inside var(..., <color>)
  const varPattern = new RegExp(
    `var\\([^)]*,\\s*${match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
  );
  return varPattern.test(line);
}

function isInHslVar(line: string): boolean {
  // hsl(var(--...)) is acceptable — it uses a CSS variable inside
  return HSL_VAR_PATTERN.test(line);
}

describe("Global color audit (Story 10.6, AC#8)", () => {
  const componentsDir = path.resolve(__dirname, "../../components");
  const files = getComponentFiles(componentsDir);

  it("scans at least 20 component files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no hardcoded hex colors in component files", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hexMatches = line.match(HARDCODED_HEX_PATTERN);
        if (hexMatches) {
          for (const match of hexMatches) {
            // Skip if it's a var() fallback or in a comment
            if (isInVarFallback(line, match)) {
              continue;
            }
            if (
              line.trimStart().startsWith("//") ||
              line.trimStart().startsWith("*")
            ) {
              continue;
            }
            const rel = path.relative(componentsDir, filePath);
            violations.push(`${rel}:${i + 1} — ${match}`);
          }
        }
      }
    }

    expect(
      violations,
      `Hardcoded hex colors found:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });

  it("no hardcoded rgb/hsl functions outside var() wrappers", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.trimStart().startsWith("//") ||
          line.trimStart().startsWith("*")
        ) {
          continue;
        }

        const rgbMatches = line.match(HARDCODED_RGB_PATTERN);
        if (rgbMatches) {
          for (const match of rgbMatches) {
            // Allow rgb/rgba that wrap CSS variables
            if (RGB_VAR_PATTERN.test(match)) {
              continue;
            }
            const rel = path.relative(componentsDir, filePath);
            violations.push(`${rel}:${i + 1} — ${match}`);
          }
        }

        const hslMatches = line.match(HARDCODED_HSL_PATTERN);
        if (hslMatches) {
          if (isInHslVar(line)) {
            continue;
          }
          for (const match of hslMatches) {
            const rel = path.relative(componentsDir, filePath);
            violations.push(`${rel}:${i + 1} — ${match}`);
          }
        }
      }
    }

    expect(
      violations,
      `Hardcoded color functions found:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });
});
