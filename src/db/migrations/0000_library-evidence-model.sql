CREATE TYPE "public"."authority" AS ENUM('product-doc', 'code', 'project', 'correspondence');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('product-doc', 'code', 'project', 'correspondence');--> statement-breakpoint
CREATE TYPE "public"."verification_state" AS ENUM('human-verified', 'interpreted', 'machine-read');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "document_kind" NOT NULL,
	"jurisdiction" text,
	"edition" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_id_owner_key" UNIQUE("id","owner_id"),
	CONSTRAINT "documents_title_nonempty" CHECK (length(trim("documents"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "extracted_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passage_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"property_id" text NOT NULL,
	"raw" text NOT NULL,
	"method_id" text NOT NULL,
	"authority" "authority" NOT NULL,
	"verification" "verification_state" NOT NULL,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extracted_values_property_nonempty" CHECK (length(trim("extracted_values"."property_id")) > 0),
	CONSTRAINT "extracted_values_raw_nonempty" CHECK (length(trim("extracted_values"."raw")) > 0),
	CONSTRAINT "extracted_values_method_nonempty" CHECK (length(trim("extracted_values"."method_id")) > 0),
	CONSTRAINT "extracted_values_verifier_matches_state" CHECK (("extracted_values"."verification" = 'human-verified') = ("extracted_values"."verified_by" is not null))
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"locator" text NOT NULL,
	"quote" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passages_id_owner_key" UNIQUE("id","owner_id"),
	CONSTRAINT "passages_document_locator_key" UNIQUE("document_id","locator"),
	CONSTRAINT "passages_locator_nonempty" CHECK (length(trim("passages"."locator")) > 0),
	CONSTRAINT "passages_quote_nonempty" CHECK (length(trim("passages"."quote")) > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_values" ADD CONSTRAINT "extracted_values_passage_owner_fkey" FOREIGN KEY ("passage_id","owner_id") REFERENCES "public"."passages"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_values" ADD CONSTRAINT "extracted_values_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_document_owner_fkey" FOREIGN KEY ("document_id","owner_id") REFERENCES "public"."documents"("id","owner_id") ON DELETE no action ON UPDATE no action;