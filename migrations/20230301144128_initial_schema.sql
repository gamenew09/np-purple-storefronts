alter table "auth"."users" add column "deleted_at" timestamp with time zone;

alter table "auth"."users" alter column "phone" set data type text using "phone"::text;

alter table "auth"."users" alter column "phone_change" set data type text using "phone_change"::text;


create table "public"."storefronts" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone default now(),
    "location" jsonb not null,
    "title" character varying not null default ''::character varying,
    "description" text,
    "owner_id" uuid
);


alter table "public"."storefronts" enable row level security;

CREATE UNIQUE INDEX storefronts_pkey ON public.storefronts USING btree (id);

alter table "public"."storefronts" add constraint "storefronts_pkey" PRIMARY KEY using index "storefronts_pkey";

alter table "public"."storefronts" add constraint "storefronts_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) not valid;

alter table "public"."storefronts" validate constraint "storefronts_owner_id_fkey";

create policy "Enable read access for all users"
on "public"."storefronts"
as permissive
for select
to public
using (true);



alter table "storage"."buckets" add column "allowed_mime_types" text[];

alter table "storage"."buckets" add column "avif_autodetection" boolean default false;

alter table "storage"."buckets" add column "file_size_limit" bigint;


