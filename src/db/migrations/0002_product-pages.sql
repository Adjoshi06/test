CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_id_owner_key" UNIQUE("id","owner_id"),
	CONSTRAINT "products_owner_slug_key" UNIQUE("owner_id","slug"),
	CONSTRAINT "products_slug_nonempty" CHECK (length(trim("products"."slug")) > 0),
	CONSTRAINT "products_name_nonempty" CHECK (length(trim("products"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "extracted_values" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_values" ADD CONSTRAINT "extracted_values_product_owner_fkey" FOREIGN KEY ("product_id","owner_id") REFERENCES "public"."products"("id","owner_id") ON DELETE no action ON UPDATE no action;