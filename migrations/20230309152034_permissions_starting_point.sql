create table "public"."permissions" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone default now(),
    "user_id" uuid
);


alter table "public"."permissions" enable row level security;

CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id);

alter table "public"."permissions" add constraint "permissions_pkey" PRIMARY KEY using index "permissions_pkey";

alter table "public"."permissions" add constraint "permissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."permissions" validate constraint "permissions_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$BEGIN
  return (
    select exists(
      select 1 from permissions where user_id = auth.uid()
    )
  );
END;$function$
;

create policy "Enable read access for admin users"
on "public"."permissions"
as permissive
for select
to authenticated
using ((user_id = auth.uid()));


create policy "Enable delete for users based on user_id"
on "public"."storefronts"
as permissive
for delete
to authenticated
using (is_admin());


create policy "Enable insert for authenticated users only"
on "public"."storefronts"
as permissive
for insert
to authenticated
with check (is_admin());


create policy "Enable update for users if they are admins"
on "public"."storefronts"
as permissive
for update
to authenticated
using (is_admin())
with check (is_admin());



