import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { ghostCard, interaction } from "@pause/db/schema";
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

  // --- Parse cursor from query params ---
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");

  // --- Build query ---
  const conditions = [eq(ghostCard.userId, session.user.id)];

  if (cursor) {
    // Cursor format: "createdAt|id"
    const [cursorDate, cursorId] = cursor.split("|");
    const parsedDate = cursorDate ? new Date(cursorDate) : null;
    if (parsedDate && !Number.isNaN(parsedDate.getTime()) && cursorId) {
      const cursorCondition = or(
        lt(ghostCard.createdAt, parsedDate),
        and(eq(ghostCard.createdAt, parsedDate), lt(ghostCard.id, cursorId))
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }
  }

  let rows: {
    id: string;
    interactionId: string;
    status: string;
    satisfactionFeedback: string | null;
    createdAt: Date;
    tier: string;
    outcome: string | null;
    metadata: unknown;
  }[];
  try {
    rows = await withTimeout(
      db
        .select({
          id: ghostCard.id,
          interactionId: ghostCard.interactionId,
          status: ghostCard.status,
          satisfactionFeedback: ghostCard.satisfactionFeedback,
          createdAt: ghostCard.createdAt,
          tier: interaction.tier,
          outcome: interaction.outcome,
          metadata: interaction.metadata,
        })
        .from(ghostCard)
        .innerJoin(interaction, eq(ghostCard.interactionId, interaction.id))
        .where(and(...conditions))
        .orderBy(desc(ghostCard.createdAt), desc(ghostCard.id))
        .limit(PAGE_SIZE + 1),
      DB_TIMEOUT_MS
    );
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  // --- Determine next cursor ---
  const hasMore = rows.length > PAGE_SIZE;
  const cards = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const nextCursor = hasMore
    ? `${cards[PAGE_SIZE - 1].createdAt.toISOString()}|${cards[PAGE_SIZE - 1].id}`
    : null;

  // --- Shape response ---
  const shaped = cards.map((row) => {
    const meta = row.metadata as Record<string, unknown> | null;
    const purchaseCtx = meta?.purchaseContext as
      | Record<string, unknown>
      | undefined;

    return {
      id: row.id,
      interactionId: row.interactionId,
      status: row.status,
      satisfactionFeedback: row.satisfactionFeedback ?? null,
      createdAt: row.createdAt.toISOString(),
      tier: row.tier,
      outcome: row.outcome,
      purchaseContext: purchaseCtx
        ? {
            itemName: (purchaseCtx.itemName as string) ?? undefined,
            price: (purchaseCtx.price as number) ?? undefined,
            merchant: (purchaseCtx.merchant as string) ?? undefined,
          }
        : null,
    };
  });

  return Response.json({ cards: shaped, nextCursor });
}
