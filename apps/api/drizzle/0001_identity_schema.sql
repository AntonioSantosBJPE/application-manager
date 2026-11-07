CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE TYPE "identity"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "identity"."invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "identity"."login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	"pair_cleared" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "identity"."user_role" NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "identity"."invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_email_unique" ON "identity"."invitations" USING btree ("email") WHERE accepted_at is null and revoked_at is null;--> statement-breakpoint
CREATE INDEX "invitations_pending_expires_at_index" ON "identity"."invitations" USING btree ("expires_at") WHERE accepted_at is null and revoked_at is null;--> statement-breakpoint
CREATE INDEX "login_attempts_ip_attempted_at_index" ON "identity"."login_attempts" USING btree ("ip","attempted_at");--> statement-breakpoint
CREATE INDEX "login_attempts_email_ip_attempted_at_index" ON "identity"."login_attempts" USING btree ("email","ip","attempted_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_expires_at_index" ON "identity"."sessions" USING btree ("user_id","expires_at");