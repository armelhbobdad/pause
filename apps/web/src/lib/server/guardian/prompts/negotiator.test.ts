import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NEGOTIATOR_SYSTEM_PROMPT } from "./negotiator";

describe("Negotiator system prompt", () => {
  it("contains bestOffer tool output format guidance", () => {
    expect(NEGOTIATOR_SYSTEM_PROMPT).toContain("bestOffer");
    expect(NEGOTIATOR_SYSTEM_PROMPT).toContain("search_coupons");
  });

  it("contains null bestOffer skip path instruction", () => {
    expect(NEGOTIATOR_SYSTEM_PROMPT).toContain("`bestOffer` is null");
    expect(NEGOTIATOR_SYSTEM_PROMPT).toContain("couldn't find savings");
  });

  it("contains price_match conditional language", () => {
    expect(NEGOTIATOR_SYSTEM_PROMPT).toContain("price_match");
    expect(NEGOTIATOR_SYSTEM_PROMPT).toContain("price match");
  });
});
