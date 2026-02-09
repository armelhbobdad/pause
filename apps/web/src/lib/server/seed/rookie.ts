/**
 * Seeds the database with a fresh "Rookie" user state.
 */
import { db } from "@pause/db";
import { card, skillbook, user } from "@pause/db/schema";
import { cleanDemoData } from "./clean";
import {
  checkDemoSafety,
  DEMO_CARD_ID,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
} from "./constants";

export async function seedRookie(): Promise<void> {
  checkDemoSafety();

  console.log("Cleaning existing demo data...");
  await cleanDemoData(DEMO_USER_ID);

  console.log("Creating rookie state...");

  await db.insert(user).values({
    id: DEMO_USER_ID,
    name: "Alex",
    email: DEMO_USER_EMAIL,
    emailVerified: true,
  });

  await db.insert(card).values({
    id: DEMO_CARD_ID,
    userId: DEMO_USER_ID,
    lastFour: "4242",
    nickname: "Demo Card",
    status: "active",
  });

  await db.insert(skillbook).values({
    id: "demo-skillbook",
    userId: DEMO_USER_ID,
    skills: {},
    version: 1,
  });

  // Auth account with password (for demo login button)
  const { account: accountTable } = await import("@pause/db/schema/auth");
  const { hashPassword } = await import("better-auth/crypto");
  const { DEMO_ACCOUNT_ID, DEMO_PASSWORD } = await import("./constants");
  const hashedPw = await hashPassword(DEMO_PASSWORD);
  await db.insert(accountTable).values({
    id: DEMO_ACCOUNT_ID,
    accountId: DEMO_USER_ID,
    providerId: "credential",
    userId: DEMO_USER_ID,
    password: hashedPw,
  });

  console.log("✓ Rookie state seeded successfully");
  console.log("  User:      Alex (demo-user)");
  console.log("  Card:      **** 4242 (Demo Card)");
  console.log("  Skillbook: empty (version 1)");
  console.log("  History:   none");
}
