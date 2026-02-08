import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { interaction, savings } from "@pause/db/schema";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { withTimeout } from "@/lib/server/utils";

export const runtime = "nodejs";

const PAGE_SIZE = 10;
const DB_TIMEOUT_MS = 10_000;

export async function GET(req: Request) {
  // --- Auth check ---
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Parse query params ---
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const tierFilter = url.searchParams.get("tier");
  const outcomeFilter = url.searchParams.get("outcome");

  const validTiers = ["analyst", "negotiator", "therapist"] as const;
  const validOutcomes = [
    "accepted",
    "overridden",
    "abandoned",
    "timeout",
    "auto_approved",
    "break_glass",
    "wait",
    "wizard_bookmark",
    "wizard_abandoned",
  ] as const;

  // --- Build query conditions ---
  const conditions = [eq(interaction.userId, session.user.id)];

  if (
    tierFilter &&
    validTiers.includes(tierFilter as (typeof validTiers)[number])
  ) {
    conditions.push(
      eq(interaction.tier, tierFilter as (typeof validTiers)[number])
    );
  }

  if (
    outcomeFilter &&
    validOutcomes.includes(outcomeFilter as (typeof validOutcomes)[number])
  ) {
    conditions.push(
      eq(interaction.outcome, outcomeFilter as (typeof validOutcomes)[number])
    );
  }

  if (cursor) {
    // Cursor format: "createdAt|id"
    const [cursorDate, cursorId] = cursor.split("|");
    const parsedDate = cursorDate ? new Date(cursorDate) : null;
    if (parsedDate && !Number.isNaN(parsedDate.getTime()) && cursorId) {
      const cursorCondition = or(
        lt(interaction.createdAt, parsedDate),
        and(eq(interaction.createdAt, parsedDate), lt(interaction.id, cursorId))
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }
  }

  let rows: {
    id: string;
    tier: string;
    outcome: string | null;
    reasoningSummary: string | null;
    metadata: unknown;
    createdAt: Date;
    savingsAmountCents: number | null;
    couponCode: string | null;
  }[];
  try {
    rows = await withTimeout(
      db
        .select({
          id: interaction.id,
          tier: interaction.tier,
          outcome: interaction.outcome,
          reasoningSummary: interaction.reasoningSummary,
          metadata: interaction.metadata,
          createdAt: interaction.createdAt,
          savingsAmountCents: savings.amountCents,
          couponCode: savings.couponCode,
        })
        .from(interaction)
        .leftJoin(savings, eq(interaction.id, savings.interactionId))
        .where(and(...conditions))
        .orderBy(desc(interaction.createdAt), desc(interaction.id))
        .limit(PAGE_SIZE + 1),
      DB_TIMEOUT_MS
    );
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  // --- Determine next cursor ---
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const nextCursor = hasMore
    ? `${items[PAGE_SIZE - 1].createdAt.toISOString()}|${items[PAGE_SIZE - 1].id}`
    : null;

  // --- Shape response ---
  const shaped = items.map((row) => {
    const meta = row.metadata as Record<string, unknown> | null;
    const purchaseCtx = meta?.purchaseContext as
      | Record<string, unknown>
      | undefined;

    return {
      id: row.id,
      tier: row.tier,
      outcome: row.outcome,
      reasoningSummary: row.reasoningSummary ?? null,
      createdAt: row.createdAt.toISOString(),
      savingsAmountCents: row.savingsAmountCents ?? null,
      couponCode: row.couponCode ?? null,
      purchaseContext: purchaseCtx
        ? {
            itemName: (purchaseCtx.itemName as string) ?? undefined,
            price: (purchaseCtx.price as number) ?? undefined,
            merchant: (purchaseCtx.merchant as string) ?? undefined,
            category: (purchaseCtx.category as string) ?? undefined,
          }
        : null,
    };
  });

  return Response.json({ interactions: shaped, nextCursor });
}
