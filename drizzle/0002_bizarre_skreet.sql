CREATE TABLE "ai_generation_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_message_id" uuid NOT NULL,
	"assistant_message_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_quota_windows" (
	"provider" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_blocked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_quota_windows_provider_window_start_pk" PRIMARY KEY("provider","window_start")
);
--> statement-breakpoint
ALTER TABLE "ai_generation_attempts" ADD CONSTRAINT "ai_generation_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generation_attempts_user_message_idx" ON "ai_generation_attempts" USING btree ("user_message_id");--> statement-breakpoint
CREATE INDEX "ai_generation_attempts_user_window_idx" ON "ai_generation_attempts" USING btree ("user_id","window_start");--> statement-breakpoint
CREATE INDEX "ai_generation_attempts_created_idx" ON "ai_generation_attempts" USING btree ("created_at");