CREATE TYPE "public"."satisfaction_feedback" AS ENUM('worth_it', 'regret_it', 'not_sure');--> statement-breakpoint
DROP INDEX "ghost_card_interaction_id_idx";--> statement-breakpoint
ALTER TABLE "ghost_card" ADD COLUMN "satisfaction_feedback" "satisfaction_feedback";