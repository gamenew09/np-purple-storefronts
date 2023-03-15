create policy "Enable read access for all users"
on "public"."storefront_categories"
as permissive
for select
to public
using (true);



