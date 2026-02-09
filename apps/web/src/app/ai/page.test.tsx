import { describe, expect, it, vi } from "vitest";

const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import AIPage from "./page";

describe("/ai page redirect (Story 10.6)", () => {
  it("redirects to /dashboard", () => {
    AIPage();
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("calls redirect exactly once", () => {
    mockRedirect.mockClear();
    AIPage();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });
});
