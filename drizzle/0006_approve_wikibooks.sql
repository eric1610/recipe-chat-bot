INSERT INTO "recipe_source_policies" (
	"hostname",
	"status",
	"allowed_path_prefixes",
	"terms_url",
	"attribution_name",
	"parser",
	"reviewed_at",
	"notes",
	"created_at",
	"updated_at"
) VALUES (
	'en.wikibooks.org',
	'approved',
	'["/wiki/Cookbook:"]'::jsonb,
	'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
	'Wikibooks Cookbook contributors',
	'mediawiki_cookbook',
	'2026-08-14T00:00:00Z',
	'Text is reused through the official MediaWiki API under CC BY-SA 4.0. Attribution links to the source page and modifications must be disclosed. Images are not imported.',
	now(),
	now()
)
ON CONFLICT ("hostname") DO UPDATE SET
	"status" = EXCLUDED."status",
	"allowed_path_prefixes" = EXCLUDED."allowed_path_prefixes",
	"terms_url" = EXCLUDED."terms_url",
	"attribution_name" = EXCLUDED."attribution_name",
	"parser" = EXCLUDED."parser",
	"reviewed_at" = EXCLUDED."reviewed_at",
	"notes" = EXCLUDED."notes",
	"updated_at" = now();
