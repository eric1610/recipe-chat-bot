CREATE TABLE "allergen_catalog" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"jurisdiction" text NOT NULL,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allergen_catalog_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_allergies" (
	"user_id" text NOT NULL,
	"normalized_name" text NOT NULL,
	"display_name" text NOT NULL,
	"catalog_slug" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_allergies_user_id_normalized_name_pk" PRIMARY KEY("user_id","normalized_name")
);
--> statement-breakpoint
ALTER TABLE "user_allergies" ADD CONSTRAINT "user_allergies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_allergies" ADD CONSTRAINT "user_allergies_catalog_slug_allergen_catalog_slug_fk" FOREIGN KEY ("catalog_slug") REFERENCES "public"."allergen_catalog"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_allergies_catalog_idx" ON "user_allergies" USING btree ("catalog_slug");--> statement-breakpoint
INSERT INTO "allergen_catalog" ("slug", "name", "aliases", "jurisdiction", "source_url") VALUES
	('eggs', 'Eggs', '["egg"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('milk', 'Milk', '["dairy", "butter", "buttermilk", "cheese", "cream", "ghee", "whey", "yogurt", "yoghurt"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('mustard', 'Mustard', '[]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('peanuts', 'Peanuts', '["peanut", "peanut butter", "groundnut", "groundnuts"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('crustaceans-molluscs', 'Crustaceans and molluscs', '["shellfish", "shrimp", "prawn", "prawns", "crab", "lobster", "crayfish", "scallop", "scallops", "clam", "clams", "mussel", "mussels", "oyster", "oysters"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('fish', 'Fish', '["salmon", "tuna", "cod", "haddock", "trout", "anchovy", "anchovies"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('sesame-seeds', 'Sesame seeds', '["sesame", "tahini", "benne"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('soy', 'Soy', '["soya", "soybean", "soybeans", "tofu", "tempeh", "edamame", "miso"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('sulphites', 'Sulphites', '["sulphite", "sulfite", "sulfites"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('tree-nuts', 'Tree nuts', '["tree nut", "almond", "almonds", "brazil nut", "brazil nuts", "cashew", "cashews", "hazelnut", "hazelnuts", "macadamia nut", "macadamia nuts", "pecan", "pecans", "pine nut", "pine nuts", "pistachio", "pistachios", "walnut", "walnuts"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html'),
	('wheat-triticale', 'Wheat and triticale', '["wheat", "triticale", "spelt", "kamut", "semolina", "all-purpose flour", "bread flour"]'::jsonb, 'CA', 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-allergies-intolerances/food-allergies.html');
--> statement-breakpoint
INSERT INTO "user_allergies" (
	"user_id",
	"normalized_name",
	"display_name",
	"catalog_slug",
	"source",
	"created_at",
	"updated_at"
)
SELECT DISTINCT ON (preferences."user_id", lower(COALESCE(catalog."name", btrim(allergy.value))))
	preferences."user_id",
	lower(COALESCE(catalog."name", btrim(allergy.value))),
	COALESCE(catalog."name", btrim(allergy.value)),
	catalog."slug",
	'settings',
	preferences."created_at",
	preferences."updated_at"
FROM "user_preferences" AS preferences
CROSS JOIN LATERAL jsonb_array_elements_text(preferences."allergies") AS allergy(value)
LEFT JOIN "allergen_catalog" AS catalog
	ON lower(btrim(allergy.value)) = lower(catalog."name")
	OR EXISTS (
		SELECT 1
		FROM jsonb_array_elements_text(catalog."aliases") AS alias(value)
		WHERE lower(btrim(allergy.value)) = lower(alias.value)
	)
WHERE btrim(allergy.value) <> ''
ORDER BY preferences."user_id", lower(COALESCE(catalog."name", btrim(allergy.value)));
--> statement-breakpoint
ALTER TABLE "user_preferences" DROP COLUMN "allergies";
