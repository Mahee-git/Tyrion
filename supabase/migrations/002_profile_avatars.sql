-- Tyrion: profile photos
-- Run this file once in Supabase Dashboard -> SQL Editor.
-- Photos are stored at avatars/<your-user-id>/avatar.jpg. Anyone can view a photo by its link,
-- but each signed-in user can only upload, replace or delete files inside their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "public can view avatars" on storage.objects;
create policy "public can view avatars" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');

drop policy if exists "users can upload own avatar" on storage.objects;
create policy "users can upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can update own avatar" on storage.objects;
create policy "users can update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete own avatar" on storage.objects;
create policy "users can delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
