import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => ({
  dbResult: [] as Array<{ skills: unknown; version: number }>,
  dbError: null as Error | null,
  mockWrapContext: vi.fn((): string => ""),
  mockDbSelect: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@pause/ace", () => {
  // biome-ignore lint/suspicious/noEmptyBlockStatements: mock constructor has no body
  function MockSkillbook() {}
  MockSkillbook.loads = (json: string) => {
    JSON.parse(json);
    return new (MockSkillbook as unknown as new () => unknown)();
  };
  return {
    Skillbook: MockSkillbook,
    wrapSkillbookContext: mocks.mockWrapContext,
  };
});

vi.mock("@pause/db", () => ({
  db: {
    select: mocks.mockDbSelect,
  },
}));

vi.mock("@pause/db/schema", () => ({
  skillbook: { skills: "skills", version: "version", userId: "user_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>) => promise),
}));

import { loadUserSkillbook } from "./ace";

describe("loadUserSkillbook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbResult = [];
    mocks.dbError = null;
    mocks.mockWrapContext.mockImplementation((): string => "");

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(() => {
        if (mocks.dbError) {
          return Promise.reject(mocks.dbError);
        }
        return Promise.resolve(mocks.dbResult);
      }),
    };
    mocks.mockDbSelect.mockReturnValue(selectChain);
  });

  it("returns formatted context for existing skillbook", async () => {
    mocks.dbResult = [{ skills: { some: "skills" }, version: 1 }];
    mocks.mockWrapContext.mockReturnValue("[skillbook context]");
    const result = await loadUserSkillbook("user-123");
    expect(mocks.mockWrapContext).toHaveBeenCalled();
    expect(result).toBe("[skillbook context]");
  });

  it("returns empty context for new user (no record)", async () => {
    mocks.dbResult = [];
    const result = await loadUserSkillbook("new-user");
    expect(mocks.mockWrapContext).toHaveBeenCalled();
    expect(result).toBe("");
  });

  it("throws on DB error so route handler can set serviceHealth.ace", async () => {
    mocks.dbError = new Error("Connection timeout");
    await expect(loadUserSkillbook("user-123")).rejects.toThrow(
      "Connection timeout"
    );
  });

  it("throws on DB timeout so route handler can set serviceHealth.ace", async () => {
    mocks.dbError = new Error("Operation timed out");
    await expect(loadUserSkillbook("user-123")).rejects.toThrow(
      "Operation timed out"
    );
  });

  it("truncates context exceeding 8000 characters", async () => {
    mocks.dbResult = [{ skills: { some: "skills" }, version: 1 }];
    const longContext = "x".repeat(9000);
    mocks.mockWrapContext.mockReturnValue(longContext);

    const result = await loadUserSkillbook("user-123");
    expect(result.length).toBeLessThan(9000);
    expect(result).toContain("[Skillbook truncated - showing top strategies]");
    expect(result.startsWith("x".repeat(8000))).toBe(true);
  });

  it("does not truncate context at exactly 8000 characters", async () => {
    mocks.dbResult = [{ skills: { some: "skills" }, version: 1 }];
    const exactContext = "x".repeat(8000);
    mocks.mockWrapContext.mockReturnValue(exactContext);

    const result = await loadUserSkillbook("user-123");
    expect(result).toBe(exactContext);
    expect(result).not.toContain("[Skillbook truncated");
  });
});
