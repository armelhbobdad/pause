/**
 * Seeds the database with an experienced "Pro" user state.
 *
 * Creates: demo user, payment card, 6 interactions, trained skillbook,
 * 3 savings records (~$53), and 1 ghost card awaiting feedback.
 */
import { Skillbook } from "@pause/ace";
import { db } from "@pause/db";
import {
  card,
  ghostCard,
  interaction,
  savings,
  skillbook,
  user,
} from "@pause/db/schema";
import { cleanDemoData } from "./clean";
import {
  checkDemoSafety,
  DEMO_CARD_ID,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
} from "./constants";

const DAY = 24 * 60 * 60 * 1000;

function buildSkillbook(): Skillbook {
  const sb = new Skillbook();
  sb.addSkill(
    "therapist",
    "Future-self visualization: ask the user to imagine how their future self will feel about this purchase in 30 days",
    "strat-001",
    { helpful: 3, harmful: 1, neutral: 0 }
  );
  sb.addSkill(
    "negotiator",
    "Cost reframe: express daily cost over a year to put the price in perspective",
    "strat-002",
    { helpful: 2, harmful: 0, neutral: 1 }
  );
  sb.addSkill("therapist", "Impulse delay timer suggestion", "strat-003", {
    helpful: 0,
    harmful: 2,
    neutral: 1,
  });
  sb.addSkill(
    "negotiator",
    "Always search for coupons on electronics",
    "strat-004",
    { helpful: 4, harmful: 0, neutral: 0 }
  );
  return sb;
}

export async function seedPro(): Promise<void> {
  checkDemoSafety();

  console.log("Cleaning existing demo data...");
  await cleanDemoData(DEMO_USER_ID);

  const now = Date.now();

  console.log("Creating pro state...");

  // 1. User (30 days ago)
  await db.insert(user).values({
    id: DEMO_USER_ID,
    name: "Alex",
    email: DEMO_USER_EMAIL,
    emailVerified: true,
    createdAt: new Date(now - 30 * DAY),
  });

  // 2. Card with unlock history
  await db.insert(card).values({
    id: DEMO_CARD_ID,
    userId: DEMO_USER_ID,
    lastFour: "4242",
    nickname: "Demo Card",
    status: "active",
    lockedAt: new Date(now - 7 * DAY),
    unlockedAt: new Date(now - 7 * DAY + 5 * 60 * 1000),
  });

  // 3. Six interactions with relative timestamps
  await db.insert(interaction).values({
    id: "int-1",
    userId: DEMO_USER_ID,
    cardId: DEMO_CARD_ID,
    tier: "analyst",
    outcome: "auto_approved",
    riskScore: 15,
    status: "completed",
    metadata: {
      purchaseContext: {
        itemName: "Coffee subscription",
        price: 1200,
        merchant: "Blue Bottle Coffee",
      },
    },
    reasoningSummary:
      "Low-risk recurring purchase. Auto-approved based on amount and history.",
    createdAt: new Date(now - 14 * DAY),
  });

  await db.insert(interaction).values({
    id: "int-2",
    userId: DEMO_USER_ID,
    cardId: DEMO_CARD_ID,
    tier: "negotiator",
    outcome: "accepted",
    riskScore: 45,
    status: "completed",
    metadata: {
      purchaseContext: {
        itemName: "Bluetooth speaker",
        price: 7900,
        merchant: "Amazon",
      },
    },
    reasoningSummary:
      "Found coupon TECH20 saving $15. User accepted after seeing savings.",
    createdAt: new Date(now - 10 * DAY),
  });

  await db.insert(interaction).values({
    id: "int-3",
    userId: DEMO_USER_ID,
    cardId: DEMO_CARD_ID,
    tier: "therapist",
    outcome: "wait",
    riskScore: 72,
    status: "feedback_received",
    metadata: {
      purchaseContext: {
        itemName: "Designer shoes",
        price: 25_000,
        merchant: "Nordstrom",
      },
    },
    reasoningSummary:
      "High-risk impulse purchase. User chose to wait after future-self reflection.",
    createdAt: new Date(now - 7 * DAY),
  });

  await db.insert(interaction).values({
    id: "int-4",
    userId: DEMO_USER_ID,
    cardId: DEMO_CARD_ID,
    tier: "negotiator",
    outcome: "overridden",
    riskScore: 50,
    status: "completed",
    metadata: {
      purchaseContext: {
        itemName: "Gaming mouse",
        price: 6500,
        merchant: "Best Buy",
      },
    },
    reasoningSummary:
      "Found price match saving $20. User overrode Guardian recommendation.",
    createdAt: new Date(now - 5 * DAY),
  });

  await db.insert(interaction).values({
    id: "int-5",
    userId: DEMO_USER_ID,
    cardId: DEMO_CARD_ID,
    tier: "therapist",
    outcome: "accepted",
    riskScore: 65,
    status: "feedback_received",
    metadata: {
      purchaseContext: {
        itemName: "Wireless headphones",
        price: 8900,
        merchant: "Apple Store",
      },
    },
    reasoningSummary:
      "Moderate-risk purchase. User accepted after cost reframe and reflection.",
    createdAt: new Date(now - 3 * DAY),
  });

  await db.insert(interaction).values({
    id: "int-6",
    userId: DEMO_USER_ID,
    cardId: DEMO_CARD_ID,
    tier: "analyst",
    outcome: "auto_approved",
    riskScore: 20,
    status: "completed",
    metadata: {
      purchaseContext: {
        itemName: "Phone case",
        price: 1500,
        merchant: "Amazon",
      },
    },
    reasoningSummary:
      "Low-risk accessory purchase. Auto-approved based on amount.",
    createdAt: new Date(now - 1 * DAY),
  });

  // 4. Savings records (~$53 total)
  await db.insert(savings).values({
    id: "sav-1",
    interactionId: "int-2",
    amountCents: 1500,
    couponCode: "TECH20",
    source: "TechDeals",
    applied: true,
  });

  await db.insert(savings).values({
    id: "sav-2",
    interactionId: "int-4",
    amountCents: 2000,
    couponCode: "PRICEMATCH",
    source: "PriceWatch",
    applied: true,
  });

  await db.insert(savings).values({
    id: "sav-3",
    interactionId: "int-5",
    amountCents: 1800,
    couponCode: null,
    source: "waited",
    applied: true,
  });

  // 5. Trained skillbook (version 5)
  const sb = buildSkillbook();
  await db.insert(skillbook).values({
    id: "demo-skillbook",
    userId: DEMO_USER_ID,
    skills: sb.toDict(),
    version: 5,
  });

  // 6. Ghost card (linked to int-5, 3 days ago)
  await db.insert(ghostCard).values({
    id: "demo-ghost-1",
    userId: DEMO_USER_ID,
    interactionId: "int-5",
    status: "pending",
  });

  // 7. Auth account with password (for demo login button)
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

  console.log("Pro state seeded successfully");
  console.log("  User:        Alex (demo-user, 30 days old)");
  console.log("  Card:        **** 4242 (Demo Card)");
  console.log("  Interactions: 6 (analyst x2, negotiator x2, therapist x2)");
  console.log("  Skillbook:   4 strategies (version 5)");
  console.log("  Savings:     $53 across 3 records");
  console.log("  Ghost cards: 1 pending (from 3 days ago)");
}
