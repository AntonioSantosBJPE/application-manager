CREATE SCHEMA "applications";
--> statement-breakpoint
CREATE TYPE "applications"."application_status" AS ENUM('saved', 'applied', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted');--> statement-breakpoint
CREATE TYPE "applications"."event_kind" AS ENUM('status_changed', 'stage', 'note');--> statement-breakpoint
CREATE TYPE "applications"."job_level" AS ENUM('intern', 'junior', 'mid', 'senior', 'specialist');--> statement-breakpoint
CREATE TYPE "applications"."skill_requirement" AS ENUM('required', 'nice_to_have');--> statement-breakpoint
CREATE TYPE "applications"."stage" AS ENUM('screening', 'hr', 'technical', 'case', 'other');--> statement-breakpoint
CREATE TYPE "applications"."work_model" AS ENUM('remote', 'hybrid', 'onsite');--> statement-breakpoint
CREATE TABLE "applications"."application_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "applications"."event_kind" NOT NULL,
	"from_status" "applications"."application_status",
	"to_status" "applications"."application_status",
	"stage" "applications"."stage",
	"note" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "application_events_status_changed_has_to_status" CHECK ("applications"."application_events"."kind" <> 'status_changed' or "applications"."application_events"."to_status" is not null),
	CONSTRAINT "application_events_stage_has_stage" CHECK ("applications"."application_events"."kind" <> 'stage' or "applications"."application_events"."stage" is not null),
	CONSTRAINT "application_events_note_has_note" CHECK ("applications"."application_events"."kind" <> 'note' or "applications"."application_events"."note" is not null)
);
--> statement-breakpoint
CREATE TABLE "applications"."applications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"status" "applications"."application_status" NOT NULL,
	"submitted_document_id" uuid,
	"last_activity_at" timestamp with time zone NOT NULL,
	"ghost_snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "applications_job_posting_id_unique" UNIQUE("job_posting_id")
);
--> statement-breakpoint
CREATE TABLE "applications"."job_posting_skills" (
	"job_posting_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"requirement" "applications"."skill_requirement" NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "job_posting_skills_job_posting_id_skill_id_pk" PRIMARY KEY("job_posting_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "applications"."job_postings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"description" text,
	"level" "applications"."job_level" NOT NULL,
	"location" text,
	"work_model" "applications"."work_model",
	"search_text" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications"."application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications"."applications" ADD CONSTRAINT "applications_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "applications"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications"."job_posting_skills" ADD CONSTRAINT "job_posting_skills_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "applications"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_events_timeline_index" ON "applications"."application_events" USING btree ("application_id","occurred_at" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "applications_user_status_activity_index" ON "applications"."applications" USING btree ("user_id","status","last_activity_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "applications_user_status_created_index" ON "applications"."applications" USING btree ("user_id","status","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "job_posting_skills_skill_id_index" ON "applications"."job_posting_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "job_postings_user_id_index" ON "applications"."job_postings" USING btree ("user_id");