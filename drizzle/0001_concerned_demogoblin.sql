CREATE TABLE "family_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"relationship" text DEFAULT '본인' NOT NULL,
	"birth_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_members_name_unique" UNIQUE("name")
);
