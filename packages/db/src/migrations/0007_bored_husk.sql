CREATE TYPE "public"."ghost_card_status" AS ENUM('pending', 'viewed', 'feedback_given');--> statement-breakpoint
CREATE TABLE "ghost_card" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"interaction_id" text NOT NULL,
	"status" "ghost_card_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ghost_card_interaction_id_unique" UNIQUE("interaction_id")
);
--> statement-breakpoint
ALTER TABLE "ghost_card" ADD CONSTRAINT "ghost_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_card" ADD CONSTRAINT "ghost_card_interaction_id_interaction_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ghost_card_user_id_created_at_idx" ON "ghost_card" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ghost_card_interaction_id_idx" ON "ghost_card" USING btree ("interaction_id");