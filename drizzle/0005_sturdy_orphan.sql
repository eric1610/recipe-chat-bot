CREATE TABLE "recipe_search_quota_windows" (
	"window_start" timestamp with time zone PRIMARY KEY NOT NULL,
	"search_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
