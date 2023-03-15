create policy "Enable delete for users based on admin status"
on "public"."storefront_images"
as permissive
for delete
to authenticated
using (is_admin());


create policy "Enable insert for authenticated users only"
on "public"."storefront_images"
as permissive
for insert
to authenticated
with check (is_admin());


create policy "Enable update for users based on administation status"
on "public"."storefront_images"
as permissive
for update
to authenticated
using (is_admin())
with check (is_admin());



