CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"rate" numeric(18, 4) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_currency_unique" UNIQUE("currency")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"type" text NOT NULL,
	"shares" numeric(18, 6) NOT NULL,
	"price" numeric(18, 4) NOT NULL,
	"fee" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax" numeric(18, 4) DEFAULT '0' NOT NULL,
	"traded_at" date NOT NULL,
	"memo" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_account_product_date_idx" ON "transactions" USING btree ("account_id","product_id","traded_at");