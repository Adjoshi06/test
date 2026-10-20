CREATE TYPE "public"."method_kind" AS ENUM('measurement', 'classification');--> statement-breakpoint
CREATE TABLE "method_edges" (
	"from_method_id" text NOT NULL,
	"to_method_id" text NOT NULL,
	"comparable" boolean NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "method_edges_from_method_id_to_method_id_pk" PRIMARY KEY("from_method_id","to_method_id"),
	CONSTRAINT "method_edges_canonical_direction" CHECK ("method_edges"."from_method_id" < "method_edges"."to_method_id"),
	CONSTRAINT "method_edges_note_nonempty" CHECK (length(trim("method_edges"."note")) > 0)
);
--> statement-breakpoint
CREATE TABLE "methods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "method_kind" NOT NULL,
	"quantity" text NOT NULL,
	"edition" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "methods_id_lowercase" CHECK ("methods"."id" = lower("methods"."id")),
	CONSTRAINT "methods_name_nonempty" CHECK (length(trim("methods"."name")) > 0),
	CONSTRAINT "methods_quantity_nonempty" CHECK (length(trim("methods"."quantity")) > 0)
);
--> statement-breakpoint
ALTER TABLE "method_edges" ADD CONSTRAINT "method_edges_from_method_id_methods_id_fk" FOREIGN KEY ("from_method_id") REFERENCES "public"."methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_edges" ADD CONSTRAINT "method_edges_to_method_id_methods_id_fk" FOREIGN KEY ("to_method_id") REFERENCES "public"."methods"("id") ON DELETE no action ON UPDATE no action;