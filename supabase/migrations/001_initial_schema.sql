-- Tyrion: Supabase schema
-- Run this file in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null default '',
  category text not null default 'General',
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists blog_posts_status_published_idx on public.blog_posts(status, published_at desc);
create index if not exists blog_posts_author_idx on public.blog_posts(author_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.finance_state enable row level security;
alter table public.blog_posts enable row level security;

-- Users can only see their own profile row. Role changes are not permitted from the browser.
drop policy if exists "profile owner can read" on public.profiles;
create policy "profile owner can read" on public.profiles
  for select to authenticated using (id = auth.uid());

-- One JSONB finance document per user, protected by RLS.
drop policy if exists "finance owner can read" on public.finance_state;
create policy "finance owner can read" on public.finance_state
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "finance owner can insert" on public.finance_state;
create policy "finance owner can insert" on public.finance_state
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "finance owner can update" on public.finance_state;
create policy "finance owner can update" on public.finance_state
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "finance owner can delete" on public.finance_state;
create policy "finance owner can delete" on public.finance_state
  for delete to authenticated using (user_id = auth.uid());

-- Public visitors can read published posts. Admins can manage all posts.
drop policy if exists "published posts are public" on public.blog_posts;
create policy "published posts are public" on public.blog_posts
  for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists "admins can insert posts" on public.blog_posts;
create policy "admins can insert posts" on public.blog_posts
  for insert to authenticated with check (public.is_admin() and author_id = auth.uid());
drop policy if exists "admins can update posts" on public.blog_posts;
create policy "admins can update posts" on public.blog_posts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins can delete posts" on public.blog_posts;
create policy "admins can delete posts" on public.blog_posts
  for delete to authenticated using (public.is_admin());

grant select on public.blog_posts to anon, authenticated;
grant insert, update, delete on public.blog_posts to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.finance_state to authenticated;

-- After creating your account, promote only your own user to admin using:
-- update public.profiles set role = 'admin' where email = 'YOUR_LOGIN_EMAIL';


-- Public cover images. Upload/update/delete are restricted to the Supabase admin profile.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-covers', 'blog-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "public can view blog covers" on storage.objects;
create policy "public can view blog covers" on storage.objects
  for select to anon, authenticated using (bucket_id = 'blog-covers');

drop policy if exists "admins can upload blog covers" on storage.objects;
create policy "admins can upload blog covers" on storage.objects
  for insert to authenticated with check (bucket_id = 'blog-covers' and public.is_admin());

drop policy if exists "admins can update blog covers" on storage.objects;
create policy "admins can update blog covers" on storage.objects
  for update to authenticated using (bucket_id = 'blog-covers' and public.is_admin())
  with check (bucket_id = 'blog-covers' and public.is_admin());

drop policy if exists "admins can delete blog covers" on storage.objects;
create policy "admins can delete blog covers" on storage.objects
  for delete to authenticated using (bucket_id = 'blog-covers' and public.is_admin());
