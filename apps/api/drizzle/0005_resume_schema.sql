CREATE SCHEMA "resume";
--> statement-breakpoint
CREATE TYPE "resume"."language_level" AS ENUM('basic', 'intermediate', 'advanced', 'fluent', 'native');--> statement-breakpoint
CREATE TABLE "resume"."bullets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"experience_id" uuid,
	"project_id" uuid,
	"text" text NOT NULL,
	"skill_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "bullets_one_parent" CHECK (num_nonnulls("resume"."bullets"."experience_id", "resume"."bullets"."project_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "resume"."certifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"issued_on" date,
	"url" text,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume"."educations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"course" text NOT NULL,
	"institution" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume"."experiences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume"."languages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"level" "resume"."language_level" NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume"."profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text,
	"location" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "resume"."projects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"description" text,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume"."bullets" ADD CONSTRAINT "bullets_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "resume"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume"."bullets" ADD CONSTRAINT "bullets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "resume"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bullets_experience_position_index" ON "resume"."bullets" USING btree ("experience_id","position");--> statement-breakpoint
CREATE INDEX "bullets_project_position_index" ON "resume"."bullets" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "certifications_user_position_index" ON "resume"."certifications" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "educations_user_position_index" ON "resume"."educations" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "experiences_user_position_index" ON "resume"."experiences" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "languages_user_position_index" ON "resume"."languages" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "projects_user_position_index" ON "resume"."projects" USING btree ("user_id","position");