CREATE TABLE "auth_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event" text NOT NULL,
	"user_id" integer,
	"email" text,
	"reason" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_kind" CHECK ("auth_events"."event" IN ('signup', 'login', 'login_failed', 'logout'))
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "badges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_user_id_kind_unique" UNIQUE("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount_sen" integer NOT NULL,
	"frequency" text NOT NULL,
	"due_day" integer,
	"due_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checkins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkins_user_id_week_start_unique" UNIQUE("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"granted" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contributions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"amount_sen" integer NOT NULL,
	"match_sen" integer NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "earnings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"platform" text NOT NULL,
	"gross_sen" integer NOT NULL,
	"commission_sen" integer DEFAULT 0 NOT NULL,
	"incentives_sen" integer DEFAULT 0 NOT NULL,
	"tips_sen" integer DEFAULT 0 NOT NULL,
	"trips" integer,
	"hours_online" double precision,
	"source" text DEFAULT 'manual' NOT NULL,
	"verification" text DEFAULT 'self' NOT NULL,
	"extraction_confidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earnings_user_id_week_start_platform_unique" UNIQUE("user_id","week_start","platform")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"amount_sen" integer NOT NULL,
	"category" text NOT NULL,
	"note" text,
	"input" text DEFAULT 'text' NOT NULL,
	"parse_tier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index_contributions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "index_contributions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"city" text NOT NULL,
	"platform" text NOT NULL,
	"month" text NOT NULL,
	"rate_sen_per_hour" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_plans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"start_week" date NOT NULL,
	"weeks" integer NOT NULL,
	"days" integer,
	"set_aside_week_sen" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "llm_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"route" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officer_links" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "officer_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"months" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"opened_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "officer_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "pots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"target_sen" integer DEFAULT 0 NOT NULL,
	"balance_sen" integer DEFAULT 0 NOT NULL,
	"weekly_sen" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pots_user_id_kind_unique" UNIQUE("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "salary_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "salary_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"salary_sen" integer NOT NULL,
	"p_safe" double precision NOT NULL,
	"risk" text NOT NULL,
	"buffer_start_sen" integer NOT NULL,
	"result" jsonb NOT NULL,
	"model_version" text NOT NULL,
	"seed" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salary_runs_user_id_week_start_unique" UNIQUE("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "streak_freezes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "streak_freezes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "streak_freezes_user_id_week_start_unique" UNIQUE("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "tanya_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tanya_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tools" jsonb,
	"risk" text,
	"guard_triggered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"direction" text NOT NULL,
	"amount_sen" integer NOT NULL,
	"allocation" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmed_amount_sen" integer,
	"confirmed_at" timestamp with time zone,
	"verification" text DEFAULT 'self' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_user_id_week_start_unique" UNIQUE("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "user_platforms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_platforms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"platform" text NOT NULL,
	CONSTRAINT "user_platforms_user_id_platform_unique" UNIQUE("user_id","platform")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"google_sub" text,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"lang" text DEFAULT 'ms' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"city" text,
	"payday_weekday" integer,
	"default_hours" integer,
	"essentials_week_sen" integer,
	"pocket_ready" boolean DEFAULT false NOT NULL,
	"sick_days_covered" integer DEFAULT 3 NOT NULL,
	"accent" text DEFAULT 'lime' NOT NULL,
	"onboarded_at" timestamp with time zone,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_plans" ADD CONSTRAINT "leave_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_links" ADD CONSTRAINT "officer_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pots" ADD CONSTRAINT "pots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_runs" ADD CONSTRAINT "salary_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_freezes" ADD CONSTRAINT "streak_freezes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tanya_messages" ADD CONSTRAINT "tanya_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_platforms" ADD CONSTRAINT "user_platforms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_events_created_at" ON "auth_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "earnings_user_week" ON "earnings" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "llm_usage_user_route" ON "llm_usage" USING btree ("user_id","route","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tanya_user_time" ON "tanya_messages" USING btree ("user_id","created_at");