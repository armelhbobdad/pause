import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Providers from "./providers";

describe("ThemeProvider (Story 10.1)", () => {
  it("renders with dark class on html element", () => {
    render(
      <Providers>
        <div data-testid="child">content</div>
      </Providers>
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("mode-toggle component file does not exist", () => {
    const modeTogglePath = resolve(__dirname, "./mode-toggle.tsx");
    expect(existsSync(modeTogglePath)).toBe(false);
  });

  it("forcedTheme is set to dark in providers", async () => {
    const { readFileSync } = await import("node:fs");
    const providersSource = readFileSync(
      resolve(__dirname, "./providers.tsx"),
      "utf-8"
    );
    expect(providersSource).toContain('forcedTheme="dark"');
    expect(providersSource).toContain('defaultTheme="dark"');
  });

  it("does not flash light mode (no enableSystem)", async () => {
    const { readFileSync } = await import("node:fs");
    const providersSource = readFileSync(
      resolve(__dirname, "./providers.tsx"),
      "utf-8"
    );
    expect(providersSource).not.toContain("enableSystem");
  });
});
