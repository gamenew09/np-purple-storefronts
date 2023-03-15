create table "public"."storefront_images" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone default now(),
    "storefront_id" uuid,
    "image_url" text,
    "description" text,
    "credits" text
);


alter table "public"."storefront_images" enable row level security;

CREATE UNIQUE INDEX storefront_images_pkey ON public.storefront_images USING btree (id);

alter table "public"."storefront_images" add constraint "storefront_images_pkey" PRIMARY KEY using index "storefront_images_pkey";

alter table "public"."storefront_images" add constraint "storefront_images_storefront_id_fkey" FOREIGN KEY (storefront_id) REFERENCES storefronts(id) not valid;

alter table "public"."storefront_images" validate constraint "storefront_images_storefront_id_fkey";

create policy "Enable read access for all users"
on "public"."storefront_images"
as permissive
for select
to public
using (true);



