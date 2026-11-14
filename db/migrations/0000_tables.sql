CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."account_owner" AS ENUM('member', 'pool', 'community', 'system');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'accepted', 'live', 'confirming', 'settled', 'declined', 'expired', 'cancelled', 'no_show', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."cycle_status" AS ENUM('proposed', 'booked', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."skill_direction" AS ENUM('teach', 'learn');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'settle', 'refund', 'split');--> statement-breakpoint
CREATE TYPE "public"."entry_kind" AS ENUM('grant', 'hold', 'release', 'capture', 'gift', 'pool_contribution', 'refund', 'no_show_penalty', 'correction');--> statement-breakpoint
CREATE TYPE "public"."session_format" AS ENUM('live', 'group', 'in_person', 'async');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('held', 'released', 'captured');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('teacher', 'learner');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'upheld', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'matched', 'closed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "account_owner" NOT NULL,
	"owner_id" uuid NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"cached_balance_min" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"purpose" text NOT NULL,
	"engine" text NOT NULL,
	"model" text,
	"input_hash" text NOT NULL,
	"output" jsonb,
	"tokens" integer DEFAULT 0 NOT NULL,
	"proposed_action" jsonb,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_min" smallint NOT NULL,
	"end_min" smallint NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "booking_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role" "participant_role" NOT NULL,
	"cost_min" smallint DEFAULT 0 NOT NULL,
	"confirmed_at" timestamp with time zone,
	"signature" text,
	"signed_payload" text,
	"signer_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "session_format" DEFAULT 'live' NOT NULL,
	"skill_id" uuid NOT NULL,
	"offer_id" uuid,
	"request_id" uuid,
	"teacher_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"length_min" smallint NOT NULL,
	"area_cell" text,
	"room_url" text,
	"status" "booking_status" DEFAULT 'requested' NOT NULL,
	"cycle_id" uuid,
	"pool_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone,
	"first_confirmed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_keys" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"device_id" uuid NOT NULL,
	"private_jwk" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"position" smallint DEFAULT 0 NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
CREATE TABLE "dispute_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"juror_id" uuid NOT NULL,
	"decision" "dispute_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"jurors" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "endorsements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount_min" integer NOT NULL,
	"status" "hold_status" DEFAULT 'held' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"seq" bigint PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"kind" "entry_kind" NOT NULL,
	"debit_account" uuid NOT NULL,
	"credit_account" uuid NOT NULL,
	"amount_min" integer NOT NULL,
	"booking_id" uuid,
	"memo" text DEFAULT '' NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	"signer_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_id_unique" UNIQUE("id"),
	CONSTRAINT "ledger_entries_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "member_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"direction" "skill_direction" NOT NULL,
	"level" smallint NOT NULL,
	"formats" "session_format"[] DEFAULT '{live}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"trust_level" smallint DEFAULT 0 NOT NULL,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"onboarded_at" timestamp with time zone,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"translation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"formats" "session_format"[] DEFAULT '{live}' NOT NULL,
	"lengths" smallint[] DEFAULT '{30,60}' NOT NULL,
	"group_max" smallint DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"booking_id" uuid,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level" smallint NOT NULL,
	"format" "session_format" DEFAULT 'live' NOT NULL,
	"length_min" smallint NOT NULL,
	"window" jsonb,
	"text" text DEFAULT '' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"parsed_by" text DEFAULT 'form' NOT NULL,
	"embedding" vector(1536),
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"keywords" text DEFAULT '' NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "swap_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"members" uuid[] NOT NULL,
	"edges" jsonb NOT NULL,
	"score" real NOT NULL,
	"status" "cycle_status" DEFAULT 'proposed' NOT NULL,
	"accepted_by" uuid[] DEFAULT '{}' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_type" text NOT NULL,
	"context_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_members_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_members_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_teacher_id_members_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cycle_id_swap_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."swap_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_keys" ADD CONSTRAINT "bot_keys_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_keys" ADD CONSTRAINT "bot_keys_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_votes" ADD CONSTRAINT "dispute_votes_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_votes" ADD CONSTRAINT "dispute_votes_juror_id_members_id_fk" FOREIGN KEY ("juror_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_members_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_subject_id_members_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_debit_account_accounts_id_fk" FOREIGN KEY ("debit_account") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_credit_account_accounts_id_fk" FOREIGN KEY ("credit_account") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_members_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_members_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_subject_id_members_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_id_members_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_owner_unique" ON "accounts" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "availability_member_idx" ON "availability" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_participants_unique" ON "booking_participants" USING btree ("booking_id","member_id");--> statement-breakpoint
CREATE INDEX "booking_participants_member_idx" ON "booking_participants" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "bookings_teacher_idx" ON "bookings" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "devices_member_idx" ON "devices" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_votes_unique" ON "dispute_votes" USING btree ("dispute_id","juror_id");--> statement-breakpoint
CREATE UNIQUE INDEX "endorsements_unique" ON "endorsements" USING btree ("booking_id","author_id","skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holds_booking_account" ON "holds" USING btree ("booking_id","account_id");--> statement-breakpoint
CREATE INDEX "ledger_debit_idx" ON "ledger_entries" USING btree ("debit_account");--> statement-breakpoint
CREATE INDEX "ledger_credit_idx" ON "ledger_entries" USING btree ("credit_account");--> statement-breakpoint
CREATE INDEX "ledger_booking_idx" ON "ledger_entries" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_skills_unique" ON "member_skills" USING btree ("member_id","skill_id","direction");--> statement-breakpoint
CREATE INDEX "member_skills_skill_idx" ON "member_skills" USING btree ("skill_id","direction");--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_member_idx" ON "notifications" USING btree ("member_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_member_skill" ON "offers" USING btree ("member_id","skill_id");--> statement-breakpoint
CREATE INDEX "offers_skill_idx" ON "offers" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox" USING btree ("id") WHERE delivered_at IS NULL;--> statement-breakpoint
CREATE INDEX "requests_skill_status_idx" ON "requests" USING btree ("skill_id","status");--> statement-breakpoint
CREATE INDEX "requests_member_idx" ON "requests" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_side" ON "reviews" USING btree ("booking_id","author_id");--> statement-breakpoint
CREATE INDEX "reviews_subject_idx" ON "reviews" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_context_unique" ON "threads" USING btree ("context_type","context_id");