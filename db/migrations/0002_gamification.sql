CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rule" jsonb NOT NULL,
	"item_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipped" (
	"member_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"item_id" text NOT NULL,
	CONSTRAINT "equipped_member_id_slot_pk" PRIMARY KEY("member_id","slot")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"slot" text NOT NULL,
	"name" text NOT NULL,
	"unlock_rule" jsonb NOT NULL,
	"rarity" text NOT NULL,
	"animated" boolean DEFAULT false NOT NULL,
	"sprites" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitties" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"genome_code" text NOT NULL,
	"name" text NOT NULL,
	"personality" jsonb NOT NULL,
	"stage" text DEFAULT 'kitten' NOT NULL,
	"room_theme" text DEFAULT 'cozy' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kitties_genome_code_unique" UNIQUE("genome_code")
);
--> statement-breakpoint
CREATE TABLE "kitty_needs" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"hunger" real NOT NULL,
	"energy" real NOT NULL,
	"play" real NOT NULL,
	"affection" real NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_achievements" (
	"member_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_event_id" text,
	CONSTRAINT "member_achievements_member_id_achievement_id_pk" PRIMARY KEY("member_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "member_items" (
	"member_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_event_id" text,
	CONSTRAINT "member_items_member_id_item_id_pk" PRIMARY KEY("member_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "member_progress" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"level" smallint DEFAULT 1 NOT NULL,
	"rank" text DEFAULT 'kitten' NOT NULL,
	"rank_reached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"treats" integer DEFAULT 0 NOT NULL,
	"slow_blinks" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{"showKitty":true,"roam":true,"sounds":false,"notices":true,"showRank":true}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"months" smallint[] NOT NULL,
	"item_ids" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_visits" (
	"member_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_visits_member_id_skill_id_pk" PRIMARY KEY("member_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"source_event_id" text NOT NULL,
	"source" text NOT NULL,
	"amount" integer NOT NULL,
	"requested" integer NOT NULL,
	"counterpart_id" uuid,
	"booking_id" uuid,
	"reverses_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipped" ADD CONSTRAINT "equipped_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipped" ADD CONSTRAINT "equipped_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitties" ADD CONSTRAINT "kitties_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitty_needs" ADD CONSTRAINT "kitty_needs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_achievements" ADD CONSTRAINT "member_achievements_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_achievements" ADD CONSTRAINT "member_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_items" ADD CONSTRAINT "member_items_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_items" ADD CONSTRAINT "member_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_progress" ADD CONSTRAINT "member_progress_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_visits" ADD CONSTRAINT "skill_visits_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_visits" ADD CONSTRAINT "skill_visits_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_source_unique" ON "xp_events" USING btree ("member_id","source_event_id");--> statement-breakpoint
CREATE INDEX "xp_events_member_time" ON "xp_events" USING btree ("member_id","occurred_at");