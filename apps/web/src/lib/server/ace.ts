import "server-only";

import { Skillbook, wrapSkillbookContext } from "@pause/ace";
import { db } from "@pause/db";
import { skillbook as skillbookTable } from "@pause/db/schema";
import { eq } from "drizzle-orm";
import { withTimeout } from "@/lib/server/utils";

export type {
  OperationType,
  ReflectorOutput,
  Skill,
  UpdateBatch,
  UpdateOperation,
} from "@pause/ace";
// biome-ignore lint/performance/noBarrelFile: ace.ts is the adapter layer — all ACE imports flow through this module
export {
  Reflector,
  Skillbook,
  VercelAIClient,
  wrapSkillbookContext,
} from "@pause/ace";

const DB_TIMEOUT_MS = 10_000;
const MAX_CONTEXT_CHARS = 8000;

export function createSkillbook(): Skillbook {
  return new Skillbook();
}

export async function loadUserSkillbook(userId: string): Promise<string> {
  const result = await withTimeout(
    db
      .select({
        skills: skillbookTable.skills,
        version: skillbookTable.version,
      })
      .from(skillbookTable)
      .where(eq(skillbookTable.userId, userId))
      .limit(1),
    DB_TIMEOUT_MS
  );

  let instance: Skillbook;
  if (result[0]) {
    const jsonString = JSON.stringify(result[0].skills);
    instance = Skillbook.loads(jsonString);
  } else {
    instance = new Skillbook();
  }

  const context = wrapSkillbookContext(instance);

  if (context.length > MAX_CONTEXT_CHARS) {
    return `${context.substring(0, MAX_CONTEXT_CHARS)}\n\n[Skillbook truncated - showing top strategies]`;
  }

  return context;
}

export async function loadUserSkillbookInstance(userId: string): Promise<{
  skillbook: Skillbook;
  version: number;
}> {
  const result = await withTimeout(
    db
      .select({
        skills: skillbookTable.skills,
        version: skillbookTable.version,
      })
      .from(skillbookTable)
      .where(eq(skillbookTable.userId, userId))
      .limit(1),
    DB_TIMEOUT_MS
  );

  if (result[0]) {
    // Use fromDict() directly — Drizzle returns JSONB as a JS object already
    return {
      skillbook: Skillbook.fromDict(
        result[0].skills as Record<string, unknown>
      ),
      version: result[0].version,
    };
  }

  return { skillbook: new Skillbook(), version: 0 };
}
