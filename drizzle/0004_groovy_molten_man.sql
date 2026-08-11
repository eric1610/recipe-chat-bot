CREATE TABLE "recipe_cache" (
	"source_key" text PRIMARY KEY NOT NULL,
	"canonical_url" text NOT NULL,
	"hostname" text NOT NULL,
	"query_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_title" text NOT NULL,
	"normalized_facts" jsonb,
	"selection_count" integer DEFAULT 0 NOT NULL,
	"selection_window_start" timestamp with time zone NOT NULL,
	"last_selected_at" timestamp with time zone NOT NULL,
	"cached_at" timestamp with time zone,
	"refresh_after" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_cache_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE "recipe_searches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_message_id" uuid NOT NULL,
	"assistant_message_id" uuid NOT NULL,
	"query_key" text NOT NULL,
	"query_text" text NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"selected_candidate_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_source_policies" (
	"hostname" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"allowed_path_prefixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"terms_url" text NOT NULL,
	"attribution_name" text NOT NULL,
	"parser" text DEFAULT 'schema_recipe' NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_cache" ADD CONSTRAINT "recipe_cache_hostname_recipe_source_policies_hostname_fk" FOREIGN KEY ("hostname") REFERENCES "public"."recipe_source_policies"("hostname") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_searches" ADD CONSTRAINT "recipe_searches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_searches" ADD CONSTRAINT "recipe_searches_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_searches" ADD CONSTRAINT "recipe_searches_user_message_id_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_searches" ADD CONSTRAINT "recipe_searches_assistant_message_id_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_cache_hostname_idx" ON "recipe_cache" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "recipe_cache_refresh_idx" ON "recipe_cache" USING btree ("refresh_after");--> statement-breakpoint
CREATE INDEX "recipe_cache_last_selected_idx" ON "recipe_cache" USING btree ("last_selected_at");--> statement-breakpoint
CREATE INDEX "recipe_searches_user_conversation_idx" ON "recipe_searches" USING btree ("user_id","conversation_id");--> statement-breakpoint
CREATE INDEX "recipe_searches_expires_idx" ON "recipe_searches" USING btree ("expires_at");