import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokensPath = resolve(__dirname, "./tokens.css");
const tokensCss = readFileSync(tokensPath, "utf-8");

const indexPath = resolve(__dirname, "../index.css");
const indexCss = readFileSync(indexPath, "utf-8");

const RE_PAUSE_ACTIVE = /--pause-active:\s*([^;]+)/;
const RE_PAUSE_SUCCESS = /--pause-success:\s*([^;]+)/;
const RE_PAUSE_GLASS = /--pause-glass:\s*([^;]+)/;
const RE_PAUSE_SCRIM = /--pause-scrim:\s*([^;]+)/;
const RE_OKLCH = /oklch/;
const RE_BACKGROUND_OKLCH = /--background:\s*oklch/;

describe("Design Tokens (Story 10.1)", () => {
  describe("Pause design tokens exist", () => {
    const requiredTokens = [
      "--pause-active",
      "--pause-success",
      "--pause-glass",
      "--pause-scrim",
      "--pause-blur-heavy",
      "--pause-blur-medium",
      "--pause-blur-light",
      "--pause-timing-breathe",
      "--pause-timing-ripple",
      "--pause-timing-glow",
      "--pause-timing-collapse",
      "--pause-timing-reveal",
      "--pause-transition-fast",
      "--pause-transition-normal",
      "--z-base",
      "--z-card",
      "--z-float",
      "--z-overlay",
      "--z-toast",
      "--z-tooltip",
      "--pause-border-base",
      "--pause-border-elevated",
      "--pause-border-modal",
    ];

    for (const token of requiredTokens) {
      it(`defines ${token}`, () => {
        expect(tokensCss).toContain(token);
      });
    }
  });

  describe("Color values use oklch format", () => {
    it("--pause-active uses oklch", () => {
      const match = tokensCss.match(RE_PAUSE_ACTIVE);
      expect(match?.[1]).toMatch(RE_OKLCH);
    });

    it("--pause-success uses oklch", () => {
      const match = tokensCss.match(RE_PAUSE_SUCCESS);
      expect(match?.[1]).toMatch(RE_OKLCH);
    });

    it("--pause-glass uses oklch", () => {
      const match = tokensCss.match(RE_PAUSE_GLASS);
      expect(match?.[1]).toMatch(RE_OKLCH);
    });

    it("--pause-scrim uses oklch", () => {
      const match = tokensCss.match(RE_PAUSE_SCRIM);
      expect(match?.[1]).toMatch(RE_OKLCH);
    });
  });

  describe("Existing tokens preserved (FROZEN rule)", () => {
    const preservedTokens = [
      "--frost-blur",
      "--therapist-amber",
      "--savings-gold",
      "--guardian-pulse-start",
      "--guardian-pulse-end",
      "--transition-reveal",
      "--pulse-duration",
      "--card-bg",
      "--card-border",
    ];

    for (const token of preservedTokens) {
      it(`preserves ${token}`, () => {
        expect(tokensCss).toContain(token);
      });
    }
  });

  describe("Spacing tokens exist", () => {
    const spacingTokens = [
      "--space-1",
      "--space-2",
      "--space-4",
      "--space-8",
      "--space-16",
    ];

    for (const token of spacingTokens) {
      it(`defines ${token}`, () => {
        expect(tokensCss).toContain(token);
      });
    }
  });

  it("has backdrop-filter fallback in @supports block", () => {
    expect(tokensCss).toContain("@supports not (backdrop-filter: blur(10px))");
  });

  it("has forced-colors media query", () => {
    expect(tokensCss).toContain("@media (forced-colors: active)");
  });

  it("has focused-mode navbar styles", () => {
    expect(tokensCss).toContain("[data-navbar].focused-mode");
    expect(tokensCss).toContain("opacity: 0.4");
    expect(tokensCss).toContain("pointer-events: none");
  });

  describe("Dark mode tokens in index.css", () => {
    it("has .dark selector", () => {
      expect(indexCss).toContain(".dark {");
    });

    it("dark mode uses oklch for --background", () => {
      const darkSection = indexCss.slice(indexCss.indexOf(".dark {"));
      expect(darkSection).toMatch(RE_BACKGROUND_OKLCH);
    });
  });
});
