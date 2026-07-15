-- Lanta Pilates tablet + admin schema

create extension if not exists "pgcrypto";

create table if not exists public.tablet_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tablets (
  slug text primary key check (slug ~ '^tab[1-4]$'),
  user_id uuid references public.tablet_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- youtube_video_id currently stores local video file names (YouTube playback paused).
create table if not exists public.user_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.tablet_users(id) on delete cascade,
  youtube_video_id text not null check (char_length(trim(youtube_video_id)) > 0),
  title text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists user_videos_user_id_sort_idx
  on public.user_videos (user_id, sort_order, created_at);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tablet_users_updated_at on public.tablet_users;
create trigger tablet_users_updated_at
  before update on public.tablet_users
  for each row execute function public.set_updated_at();

drop trigger if exists tablets_updated_at on public.tablets;
create trigger tablets_updated_at
  before update on public.tablets
  for each row execute function public.set_updated_at();

insert into public.tablets (slug) values
  ('tab1'),
  ('tab2'),
  ('tab3'),
  ('tab4')
on conflict (slug) do nothing;

alter table public.tablet_users enable row level security;
alter table public.tablets enable row level security;
alter table public.user_videos enable row level security;

drop policy if exists "Public read tablet_users" on public.tablet_users;
create policy "Public read tablet_users"
  on public.tablet_users for select
  using (true);

drop policy if exists "Public read tablets" on public.tablets;
create policy "Public read tablets"
  on public.tablets for select
  using (true);

drop policy if exists "Public read user_videos" on public.user_videos;
create policy "Public read user_videos"
  on public.user_videos for select
  using (true);
