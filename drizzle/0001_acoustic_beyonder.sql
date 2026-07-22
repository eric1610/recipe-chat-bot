CREATE TABLE "security_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
UPDATE "account"
SET "refresh_token" = NULL,
	"access_token" = NULL,
	"id_token" = NULL,
	"session_state" = NULL;
--> statement-breakpoint
DELETE FROM "session";
--> statement-breakpoint
WITH ranked_messages AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "conversation_id"
		ORDER BY "position", "created_at", "id"
	) - 1 AS normalized_position
	FROM "messages"
)
UPDATE "messages"
SET "position" = ranked_messages.normalized_position
FROM ranked_messages
WHERE "messages"."id" = ranked_messages."id";
--> statement-breakpoint
DROP INDEX "messages_conversation_position_idx";--> statement-breakpoint
ALTER TABLE "security_rate_limits" ADD CONSTRAINT "security_rate_limits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_rate_limits_expires_idx" ON "security_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conversation_position_idx" ON "messages" USING btree ("conversation_id","position");
