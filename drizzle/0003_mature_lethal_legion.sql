CREATE TABLE "account_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tax_treatment" text DEFAULT '일반' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_types_name_unique" UNIQUE("name")
);
