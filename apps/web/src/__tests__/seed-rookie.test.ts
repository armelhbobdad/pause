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

describe("seedRookie", () => {
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

    const { seedRookie } = await import("@/lib/server/seed/rookie");

    try {
      await expect(seedRookie()).rejects.toThrow("Safety check failed");
    } finally {
      process.argv = origArgv;
    }
  });

  it("calls insert 3 times (user, card, skillbook)", async () => {
    const { seedRookie } = await import("@/lib/server/seed/rookie");
    await seedRookie();

    expect(mockInsert).toHaveBeenCalledTimes(3);
  });

  it("creates user with correct fields", async () => {
    const { seedRookie } = await import("@/lib/server/seed/rookie");
    await seedRookie();

    const firstInsertValues = mockValues.mock.calls[0][0];
    expect(firstInsertValues).toMatchObject({
      id: "demo-user",
      name: "Alex",
      email: "alex@demo.pause.app",
      emailVerified: true,
    });
  });

  it("creates card with correct fields", async () => {
    const { seedRookie } = await import("@/lib/server/seed/rookie");
    await seedRookie();

    const secondInsertValues = mockValues.mock.calls[1][0];
    expect(secondInsertValues).toMatchObject({
      id: "demo-card-4242",
      userId: "demo-user",
      lastFour: "4242",
      nickname: "Demo Card",
      status: "active",
    });
  });

  it("creates skillbook with empty skills", async () => {
    const { seedRookie } = await import("@/lib/server/seed/rookie");
    await seedRookie();

    const thirdInsertValues = mockValues.mock.calls[2][0];
    expect(thirdInsertValues).toMatchObject({
      id: "demo-skillbook",
      userId: "demo-user",
      skills: {},
      version: 1,
    });
  });

  it("cleans existing data before seeding", async () => {
    const { seedRookie } = await import("@/lib/server/seed/rookie");
    await seedRookie();

    // delete is called before insert (by cleanDemoData)
    expect(mockDelete).toHaveBeenCalled();
    const deleteOrder = mockDelete.mock.invocationCallOrder[0];
    const insertOrder = mockInsert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
  });
});
