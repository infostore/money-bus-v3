CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"date" date NOT NULL,
	"open" numeric(18, 4),
	"high" numeric(18, 4),
	"low" numeric(18, 4),
	"close" numeric(18, 4) NOT NULL,
	"volume" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_history_product_date_uniq" UNIQUE("product_id","date")
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cron_expression" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_tasks_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "task_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"products_total" integer DEFAULT 0 NOT NULL,
	"products_succeeded" integer DEFAULT 0 NOT NULL,
	"products_failed" integer DEFAULT 0 NOT NULL,
	"products_skipped" integer DEFAULT 0 NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_task_id_scheduled_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."scheduled_tasks"("id") ON DELETE cascade ON UPDATE no action;