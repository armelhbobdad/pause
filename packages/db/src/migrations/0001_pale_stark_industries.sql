CREATE TYPE "public"."card_status" AS ENUM('active', 'locked', 'removed');--> statement-breakpoint
CREATE TYPE "public"."interaction_outcome" AS ENUM('accepted', 'overridden', 'abandoned', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."interaction_status" AS ENUM('pending', 'completed', 'feedback_received', 'learning_complete');--> statement-breakpoint
CREATE TYPE "public"."interaction_tier" AS ENUM('analyst', 'negotiator', 'therapist');--> statement-breakpoint
CREATE TABLE "card" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"last_four" text NOT NULL,
	"nickname" text,
	"status" "card_status" DEFAULT 'active' NOT NULL,
	"locked_at" timestamp,
	"unlocked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"risk_score" integer,
	"tier" "interaction_tier" NOT NULL,
	"status" "interaction_status" DEFAULT 'pending' NOT NULL,
	"outcome" "interaction_outcome",
	"reasoning_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings" (
	"id" text PRIMARY KEY NOT NULL,
	"interaction_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"coupon_code" text,
	"source" text,
	"applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skillbook" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"skills" jsonb DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings" ADD CONSTRAINT "savings_interaction_id_interaction_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skillbook" ADD CONSTRAINT "skillbook_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_userId_createdAt_idx" ON "card" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "interaction_userId_createdAt_idx" ON "interaction" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "savings_interactionId_idx" ON "savings" USING btree ("interaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skillbook_userId_idx" ON "skillbook" USING btree ("user_id");