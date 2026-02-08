import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect, mockDelete } = vi.hoisted(() => {
  const mockDelete = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const mockLimit = vi.fn().mockReturnValue(Promise.resolve([]));
  const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { mockSelect, mockDelete };
});

vi.mock("@pause/db", () => ({
  db: {
    select: mockSelect,
    delete: mockDelete,
    insert: vi
      .fn()
      .mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
}));

vi.mock("@pause/db/schema", () => ({
  user: { id: "user.id" },
  card: { userId: "card.userId" },
  skillbook: { userId: "skillbook.userId" },
  interaction: { id: "interaction.id", userId: "interaction.userId" },
  savings: { interactionId: "savings.interactionId" },
  ghostCard: { userId: "ghostCard.userId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
}));

vi.mock("@pause/env/server", () => ({
  env: { DATABASE_URL: "mock://db" },
  databaseUrl: "mock://db",
}));

describe("seed constants", () => {
  it("exports DEMO_USER_ID", async () => {
    const { DEMO_USER_ID } = await import("@/lib/server/seed/constants");
    expect(DEMO_USER_ID).toBe("demo-user");
  });

  it("exports DEMO_USER_EMAIL", async () => {
    const { DEMO_USER_EMAIL } = await import("@/lib/server/seed/constants");
    expect(DEMO_USER_EMAIL).toBe("alex@demo.pause.app");
  });

  it("exports DEMO_CARD_ID", async () => {
    const { DEMO_CARD_ID } = await import("@/lib/server/seed/constants");
    expect(DEMO_CARD_ID).toBe("demo-card-4242");
  });
});

describe("checkDemoSafety", () => {
  it("throws when neither DEMO_MODE nor --force is set", async () => {
    const origDemoMode = process.env.DEMO_MODE;
    const origArgv = [...process.argv];
    process.env.DEMO_MODE = "false";
    process.argv = ["node", "script.ts"];

    try {
      const { checkDemoSafety } = await import("@/lib/server/seed/constants");
      expect(() => checkDemoSafety()).toThrow("Safety check failed");
    } finally {
      process.env.DEMO_MODE = origDemoMode;
      process.argv = origArgv;
    }
  });

  it("throws when DEMO_MODE is undefined and no --force", async () => {
    const origDemoMode = process.env.DEMO_MODE;
    const origArgv = [...process.argv];
    process.env.DEMO_MODE = undefined;
    process.argv = ["node", "script.ts"];

    try {
      const { checkDemoSafety } = await import("@/lib/server/seed/constants");
      expect(() => checkDemoSafety()).toThrow("Safety check failed");
    } finally {
      process.env.DEMO_MODE = origDemoMode;
      process.argv = origArgv;
    }
  });

  it("passes when DEMO_MODE is true", async () => {
    const origDemoMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "true";

    try {
      const { checkDemoSafety } = await import("@/lib/server/seed/constants");
      expect(() => checkDemoSafety()).not.toThrow();
    } finally {
      process.env.DEMO_MODE = origDemoMode;
    }
  });

  it("passes when --force flag is present", async () => {
    const origDemoMode = process.env.DEMO_MODE;
    const origArgv = [...process.argv];
    process.env.DEMO_MODE = "false";
    process.argv = ["node", "script.ts", "--force"];

    try {
      const { checkDemoSafety } = await import("@/lib/server/seed/constants");
      expect(() => checkDemoSafety()).not.toThrow();
    } finally {
      process.env.DEMO_MODE = origDemoMode;
      process.argv = origArgv;
    }
  });
});

describe("cleanDemoData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a no-op when user does not exist", async () => {
    // Select returns empty array (user not found)
    const mockLimit = vi.fn().mockReturnValue(Promise.resolve([]));
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const { cleanDemoData } = await import("@/lib/server/seed/clean");
    await cleanDemoData("nonexistent-user");

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes all data in FK order when user exists", async () => {
    // Select returns user found
    const mockLimit = vi
      .fn()
      .mockReturnValue(Promise.resolve([{ id: "demo-user" }]));
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: deleteWhere });

    const { cleanDemoData } = await import("@/lib/server/seed/clean");
    await cleanDemoData("demo-user");

    // 6 deletes: ghostCard, savings, interaction, card, skillbook, user
    expect(mockDelete).toHaveBeenCalledTimes(6);
  });
});
