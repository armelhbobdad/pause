import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockOrderBy = vi.fn();
  const mockLimit = vi.fn();
  const mockSelect = vi.fn();
  const mockInteractions = [] as Array<{
    outcome: string | null;
    riskScore: number | null;
  }>;

  return {
    mockSelect,
    mockFrom,
    mockWhere,
    mockOrderBy,
    mockLimit,
    mockInteractions,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@pause/db", () => {
  mocks.mockLimit.mockImplementation(() =>
    Promise.resolve(mocks.mockInteractions)
  );
  mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockWhere.mockReturnValue({ orderBy: mocks.mockOrderBy });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

  return {
    db: {
      select: mocks.mockSelect,
    },
  };
});

vi.mock("@pause/db/schema", () => ({
  interaction: {
    userId: "interaction.userId",
    outcome: "interaction.outcome",
    riskScore: "interaction.riskScore",
    createdAt: "interaction.createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  desc: vi.fn((a: unknown) => ({ desc: a })),
}));

import { checkReferralThreshold } from "./referral-detection";

describe("checkReferralThreshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockInteractions.length = 0;
    process.env.REFERRAL_THRESHOLD = undefined;
  });

  it("returns shouldShow=true with 3 consecutive high-risk overrides", async () => {
    mocks.mockInteractions.push(
      { outcome: "overridden", riskScore: 85 },
      { outcome: "overridden", riskScore: 70 },
      { outcome: "overridden", riskScore: 90 }
    );

    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(true);
    expect(result.consecutiveOverrides).toBe(3);
  });

  it("returns shouldShow=false with 2 consecutive overrides", async () => {
    mocks.mockInteractions.push(
      { outcome: "overridden", riskScore: 80 },
      { outcome: "overridden", riskScore: 75 },
      { outcome: "accepted", riskScore: 50 }
    );

    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(false);
    expect(result.consecutiveOverrides).toBe(2);
  });

  it("resets counter on accepted outcome", async () => {
    mocks.mockInteractions.push(
      { outcome: "overridden", riskScore: 80 },
      { outcome: "accepted", riskScore: 30 },
      { outcome: "overridden", riskScore: 90 },
      { outcome: "overridden", riskScore: 85 },
      { outcome: "overridden", riskScore: 70 }
    );

    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(false);
    expect(result.consecutiveOverrides).toBe(1);
  });

  it("resets counter on wait outcome", async () => {
    mocks.mockInteractions.push(
      { outcome: "overridden", riskScore: 90 },
      { outcome: "overridden", riskScore: 80 },
      { outcome: "wait", riskScore: 60 },
      { outcome: "overridden", riskScore: 70 }
    );

    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(false);
    expect(result.consecutiveOverrides).toBe(2);
  });

  it("only counts riskScore >= 70", async () => {
    mocks.mockInteractions.push(
      { outcome: "overridden", riskScore: 70 },
      { outcome: "overridden", riskScore: 71 },
      { outcome: "overridden", riskScore: 100 }
    );

    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(true);
    expect(result.consecutiveOverrides).toBe(3);
  });

  it("low-risk overrides do not count (breaks streak)", async () => {
    mocks.mockInteractions.push(
      { outcome: "overridden", riskScore: 80 },
      { outcome: "overridden", riskScore: 69 },
      { outcome: "overridden", riskScore: 90 },
      { outcome: "overridden", riskScore: 85 }
    );

    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(false);
    expect(result.consecutiveOverrides).toBe(1);
  });

  it("respects custom threshold from REFERRAL_THRESHOLD env var", async () => {
    process.env.REFERRAL_THRESHOLD = "5";

    mocks.mockInteractions.push(
      { outcome: "overridden", riskScore: 80 },
      { outcome: "overridden", riskScore: 75 },
      { outcome: "overridden", riskScore: 90 },
      { outcome: "overridden", riskScore: 85 },
      { outcome: "overridden", riskScore: 70 }
    );

    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(true);
    expect(result.consecutiveOverrides).toBe(5);
  });

  it("returns shouldShow=false with no interactions", async () => {
    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(false);
    expect(result.consecutiveOverrides).toBe(0);
  });

  it("handles null riskScore as non-qualifying", async () => {
    mocks.mockInteractions.push(
      { outcome: "overridden", riskScore: 80 },
      { outcome: "overridden", riskScore: null },
      { outcome: "overridden", riskScore: 90 }
    );

    const result = await checkReferralThreshold("user-1");

    expect(result.shouldShow).toBe(false);
    expect(result.consecutiveOverrides).toBe(1);
  });
});
