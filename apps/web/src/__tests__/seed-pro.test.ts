import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect, mockDelete, mockInsert, mockValues } = vi.hoisted(() => {
  const mockValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
  const mockLimit = vi
    .fn()
    .mockReturnValue(Promise.resolve([{ id: "demo-user" }]));
  const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { mockSelect, mockDelete, mockInsert, mockValues };
});

vi.mock("@pause/db", () => ({
  db: {
    select: mockSelect,
    delete: mockDelete,
    insert: mockInsert,
  },
}));

vi.mock("@pause/db/schema", () => ({
  user: { id: "user.id", name: "user.name", email: "user.email" },
  card: { id: "card.id", userId: "card.userId" },
  skillbook: { id: "skillbook.id", userId: "skillbook.userId" },
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

describe("seedPro", () => {
  const origDemoMode = process.env.DEMO_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEMO_MODE = "true";

    // Reset select chain for cleanDemoData (user found)
    const mockLimit = vi
      .fn()
      .mockReturnValue(Promise.resolve([{ id: "demo-user" }]));
    const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });

    mockValues.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
  });

  afterEach(() => {
    process.env.DEMO_MODE = origDemoMode;
  });

  it("throws without DEMO_MODE or --force", async () => {
    process.env.DEMO_MODE = "false";
    const origArgv = [...process.argv];
    process.argv = ["node", "test"];

    const { seedPro } = await import("@/lib/server/seed/pro");

    try {
      await expect(seedPro()).rejects.toThrow("Safety check failed");
    } finally {
      process.argv = origArgv;
    }
  });

  it("cleans existing data before seeding", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    expect(mockDelete).toHaveBeenCalled();
    const deleteOrder = mockDelete.mock.invocationCallOrder[0];
    const insertOrder = mockInsert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
  });

  it("creates user with 30-day-old createdAt", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    const before = Date.now();
    await seedPro();

    const userValues = mockValues.mock.calls[0][0];
    expect(userValues).toMatchObject({
      id: "demo-user",
      name: "Alex",
      email: "alex@demo.pause.app",
      emailVerified: true,
    });

    const createdAt = userValues.createdAt as Date;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    // Allow 5 seconds of tolerance
    expect(
      Math.abs(createdAt.getTime() - (before - thirtyDaysMs))
    ).toBeLessThan(5000);
  });

  it("creates card with active status and unlock history", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    const cardValues = mockValues.mock.calls[1][0];
    expect(cardValues).toMatchObject({
      id: "demo-card-4242",
      userId: "demo-user",
      lastFour: "4242",
      nickname: "Demo Card",
      status: "active",
    });
    expect(cardValues.lockedAt).toBeInstanceOf(Date);
    expect(cardValues.unlockedAt).toBeInstanceOf(Date);
  });

  it("creates 6 interactions across all tiers", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    // inserts: user(0), card(1), int1-6(2-7), sav1-3(8-10), skillbook(11), ghostCard(12)
    expect(mockInsert).toHaveBeenCalledTimes(13);

    const interactionCalls = mockValues.mock.calls.slice(2, 8);
    const tiers = interactionCalls.map(
      (c: unknown[]) => (c[0] as Record<string, unknown>).tier
    );
    expect(tiers).toContain("analyst");
    expect(tiers).toContain("negotiator");
    expect(tiers).toContain("therapist");
    expect(tiers.filter((t) => t === "analyst")).toHaveLength(2);
    expect(tiers.filter((t) => t === "negotiator")).toHaveLength(2);
    expect(tiers.filter((t) => t === "therapist")).toHaveLength(2);
  });

  it("includes cardId on every interaction", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    const interactionCalls = mockValues.mock.calls.slice(2, 8);
    for (const call of interactionCalls) {
      expect((call[0] as Record<string, unknown>).cardId).toBe(
        "demo-card-4242"
      );
    }
  });

  it("creates skillbook with 4 skills via Skillbook.toDict()", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    // skillbook insert is at index 11 (user, card, 6 interactions, 3 savings, skillbook)
    const skillbookValues = mockValues.mock.calls[11][0];
    expect(skillbookValues).toMatchObject({
      id: "demo-skillbook",
      userId: "demo-user",
      version: 5,
    });

    const skills = skillbookValues.skills as Record<string, unknown>;
    // toDict() returns { skills: {...}, sections: {...}, metadata: {...} }
    expect(skills).toHaveProperty("skills");
    const innerSkills = (skills as Record<string, Record<string, unknown>>)
      .skills;
    expect(Object.keys(innerSkills)).toHaveLength(4);
    expect(innerSkills).toHaveProperty("strat-001");
    expect(innerSkills).toHaveProperty("strat-002");
    expect(innerSkills).toHaveProperty("strat-003");
    expect(innerSkills).toHaveProperty("strat-004");
  });

  it("creates savings totaling $53", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    // savings inserts at index 8, 9, 10
    const savingsCalls = mockValues.mock.calls.slice(8, 11);
    const totalCents = savingsCalls.reduce(
      (sum: number, call: unknown[]) =>
        sum + (call[0] as Record<string, number>).amountCents,
      0
    );
    expect(totalCents).toBe(5300);
  });

  it("creates 1 ghost card in pending status", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    // ghost card insert is at index 12 (last)
    const ghostCardValues = mockValues.mock.calls[12][0];
    expect(ghostCardValues).toMatchObject({
      id: "demo-ghost-1",
      userId: "demo-user",
      interactionId: "int-5",
      status: "pending",
    });
  });

  it("uses relative timestamps that update each run", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    const before = Date.now();
    await seedPro();

    const interactionCalls = mockValues.mock.calls.slice(2, 8);
    const timestamps = interactionCalls.map((c: unknown[]) =>
      (c[0] as Record<string, Date>).createdAt.getTime()
    );

    // All timestamps should be in the past
    for (const ts of timestamps) {
      expect(ts).toBeLessThan(before);
    }

    // Timestamps should be ordered chronologically (oldest first)
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it("includes purchaseContext metadata on each interaction", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    const interactionCalls = mockValues.mock.calls.slice(2, 8);
    for (const call of interactionCalls) {
      const meta = (call[0] as Record<string, Record<string, string>>).metadata;
      expect(meta).toHaveProperty("purchaseContext");
      expect(typeof meta.purchaseContext).toBe("string");
    }
  });

  it("includes reasoningSummary on each interaction", async () => {
    const { seedPro } = await import("@/lib/server/seed/pro");
    await seedPro();

    const interactionCalls = mockValues.mock.calls.slice(2, 8);
    for (const call of interactionCalls) {
      const summary = (call[0] as Record<string, string>).reasoningSummary;
      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(0);
    }
  });
});
