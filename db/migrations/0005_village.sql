CREATE TYPE "public"."presence_status" AS ENUM('free', 'busy', 'away');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_id" uuid,
	"to_id" uuid NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "villagers" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"look" jsonb NOT NULL,
	"hut" jsonb NOT NULL,
	"status" "presence_status" DEFAULT 'busy' NOT NULL,
	"status_line" text DEFAULT '' NOT NULL,
	"hide_me" boolean DEFAULT false NOT NULL,
	"plain_mode" boolean DEFAULT false NOT NULL,
	"onboarding_step" smallint DEFAULT 1 NOT NULL,
	"last_input_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walk_counts" (
	"week" text NOT NULL,
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "walk_counts_week_x_y_pk" PRIMARY KEY("week","x","y")
);
--> statement-breakpoint
CREATE TABLE "worn_tiles" (
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"level" smallint NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worn_tiles_x_y_pk" PRIMARY KEY("x","y")
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_from_id_members_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_to_id_members_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "villagers" ADD CONSTRAINT "villagers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_to_idx" ON "notes" USING btree ("to_id","created_at");