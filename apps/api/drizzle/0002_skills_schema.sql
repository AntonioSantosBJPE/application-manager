CREATE SCHEMA "skills";
--> statement-breakpoint
CREATE TYPE "skills"."skill_category" AS ENUM('language', 'framework', 'database', 'cloud_devops', 'tool', 'practice', 'soft_skill');--> statement-breakpoint
CREATE TABLE "skills"."skill_aliases" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"skill_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	CONSTRAINT "skill_aliases_normalized_alias_unique" UNIQUE("normalized_alias")
);
--> statement-breakpoint
CREATE TABLE "skills"."skills" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"normalized_key" text NOT NULL,
	"category" "skills"."skill_category" NOT NULL,
	"owner_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "skills"."skill_aliases" ADD CONSTRAINT "skill_aliases_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "skills"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skills_global_key_unique" ON "skills"."skills" USING btree ("normalized_key") WHERE owner_user_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "skills_private_key_unique" ON "skills"."skills" USING btree ("owner_user_id","normalized_key") WHERE owner_user_id is not null;--> statement-breakpoint
CREATE INDEX "skills_owner_user_id_index" ON "skills"."skills" USING btree ("owner_user_id");