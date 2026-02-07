import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ============================================================================
// pgEnum Definitions
// ============================================================================

/** Interaction tier - Guardian pipeline routing decision */
export const interactionTierEnum = pgEnum("interaction_tier", [
  "analyst",
  "negotiator",
  "therapist",
]);

/** Interaction lifecycle status (ADR-006) */
export const interactionStatusEnum = pgEnum("interaction_status", [
  "pending",
  "completed",
  "feedback_received",
  "learning_complete",
]);

/** Interaction outcome - user decision after Guardian response */
export const interactionOutcomeEnum = pgEnum("interaction_outcome", [
  "accepted",
  "overridden",
  "abandoned",
  "timeout",
  "auto_approved",
  "break_glass",
  "wait",
]);

/** Card status */
export const cardStatusEnum = pgEnum("card_status", [
  "active",
  "locked",
  "removed",
]);

// ============================================================================
// Skillbook Table (ADR-008: Optimistic Locking)
// ============================================================================

export const skillbook = pgTable(
  "skillbook",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    skills: jsonb("skills").default("{}").notNull(),
    version: integer("version").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("skillbook_userId_idx").on(table.userId)]
);

// ============================================================================
// Card Table
// ============================================================================

export const card = pgTable(
  "card",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastFour: text("last_four").notNull(),
    nickname: text("nickname"),
    status: cardStatusEnum("status").default("active").notNull(),
    lockedAt: timestamp("locked_at"),
    unlockedAt: timestamp("unlocked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("card_userId_createdAt_idx").on(table.userId, table.createdAt),
  ]
);

// ============================================================================
// Interaction Table
// ============================================================================

export const interaction = pgTable(
  "interaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    riskScore: integer("risk_score"),
    tier: interactionTierEnum("tier").notNull(),
    status: interactionStatusEnum("status").default("pending").notNull(),
    outcome: interactionOutcomeEnum("outcome"),
    reasoningSummary: text("reasoning_summary"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("interaction_userId_createdAt_idx").on(table.userId, table.createdAt),
  ]
);

// ============================================================================
// Savings Table
// ============================================================================

export const savings = pgTable(
  "savings",
  {
    id: text("id").primaryKey(),
    interactionId: text("interaction_id")
      .notNull()
      .references(() => interaction.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    couponCode: text("coupon_code"),
    source: text("source"),
    applied: boolean("applied").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("savings_interactionId_idx").on(table.interactionId)]
);

// ============================================================================
// Relations
// ============================================================================

export const skillbookRelations = relations(skillbook, ({ one }) => ({
  user: one(user, {
    fields: [skillbook.userId],
    references: [user.id],
  }),
}));

export const cardRelations = relations(card, ({ one, many }) => ({
  user: one(user, {
    fields: [card.userId],
    references: [user.id],
  }),
  interactions: many(interaction),
}));

export const interactionRelations = relations(interaction, ({ one, many }) => ({
  user: one(user, {
    fields: [interaction.userId],
    references: [user.id],
  }),
  card: one(card, {
    fields: [interaction.cardId],
    references: [card.id],
  }),
  savings: many(savings),
}));

export const savingsRelations = relations(savings, ({ one }) => ({
  interaction: one(interaction, {
    fields: [savings.interactionId],
    references: [interaction.id],
  }),
}));
