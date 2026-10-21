ALTER TABLE "pots" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "pots" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "pots" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Pots become opt-in: built-ins the rider never used are "not added yet"; the buffer and PERKESO stay on.
UPDATE "pots" SET "active" = false WHERE "kind" NOT IN ('penampan', 'perkeso') AND "balance_sen" = 0 AND "weekly_sen" = 0 AND "target_sen" = 0;
