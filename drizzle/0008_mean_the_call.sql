CREATE TABLE "etf_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"etf_product_id" integer NOT NULL,
	"component_symbol" text NOT NULL,
	"component_name" text NOT NULL,
	"weight" numeric(8, 4),
	"shares" bigint,
	"snapshot_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "etf_components_product_symbol_date_uniq" UNIQUE("etf_product_id","component_symbol","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "etf_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"manager" text NOT NULL,
	"expense_ratio" numeric(6, 4),
	"download_url" text NOT NULL,
	"download_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "etf_profiles_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
ALTER TABLE "etf_components" ADD CONSTRAINT "etf_components_etf_product_id_products_id_fk" FOREIGN KEY ("etf_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etf_profiles" ADD CONSTRAINT "etf_profiles_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "etf_components_product_date_idx" ON "etf_components" USING btree ("etf_product_id","snapshot_date");