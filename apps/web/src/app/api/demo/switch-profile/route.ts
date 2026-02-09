import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { seedPro } from "@/lib/server/seed/pro";
import { seedRookie } from "@/lib/server/seed/rookie";

export async function POST(request: Request) {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Demo mode is not enabled" },
      { status: 403 }
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { profile?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { profile } = body;
  if (profile !== "rookie" && profile !== "pro") {
    return NextResponse.json(
      { error: 'Invalid profile. Must be "rookie" or "pro".' },
      { status: 400 }
    );
  }

  try {
    // Save active sessions before seeding (cleanDemoData deletes them)
    const { session: sessionTable } = await import("@pause/db/schema/auth");
    const savedSessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, session.user.id));

    if (profile === "rookie") {
      await seedRookie();
    } else {
      await seedPro();
    }

    // Restore sessions so the user stays signed in
    if (savedSessions.length > 0) {
      await db.insert(sessionTable).values(savedSessions);
    }

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error("Demo profile switch failed:", err);
    return NextResponse.json(
      { error: "Profile switch failed" },
      { status: 500 }
    );
  }
}
