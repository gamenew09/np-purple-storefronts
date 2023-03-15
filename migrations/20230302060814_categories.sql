create table "public"."storefront_categories" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone default now(),
    "title" character varying default ''::character varying,
    "is_general" boolean not null default false
);


alter table "public"."storefront_categories" enable row level security;

alter table "public"."storefronts" add column "category" uuid;

CREATE UNIQUE INDEX storefront_categories_pkey ON public.storefront_categories USING btree (id);

alter table "public"."storefront_categories" add constraint "storefront_categories_pkey" PRIMARY KEY using index "storefront_categories_pkey";

alter table "public"."storefronts" add constraint "storefronts_category_fkey" FOREIGN KEY (category) REFERENCES storefront_categories(id) not valid;

alter table "public"."storefronts" validate constraint "storefronts_category_fkey";


