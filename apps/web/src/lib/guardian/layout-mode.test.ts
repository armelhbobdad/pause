import { describe, expect, it } from "vitest";
import { getLayoutMode } from "./layout-mode";

describe("getLayoutMode", () => {
  it("returns 'minimal' for idle state", () => {
    expect(getLayoutMode("idle")).toBe("minimal");
  });

  it("returns 'focused' for expanding state", () => {
    expect(getLayoutMode("expanding")).toBe("focused");
  });

  it("returns 'focused' for active state", () => {
    expect(getLayoutMode("active")).toBe("focused");
  });

  it("returns 'focused' for collapsing state", () => {
    expect(getLayoutMode("collapsing")).toBe("focused");
  });

  it("returns 'focused' for revealed state", () => {
    expect(getLayoutMode("revealed")).toBe("focused");
  });

  it("is a pure function with no side effects", () => {
    const result1 = getLayoutMode("idle");
    const result2 = getLayoutMode("idle");
    expect(result1).toBe(result2);

    const result3 = getLayoutMode("active");
    const result4 = getLayoutMode("active");
    expect(result3).toBe(result4);
  });
});
