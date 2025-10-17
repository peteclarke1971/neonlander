-- Create scores table for online leaderboards
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  initials text not null check (char_length(initials) <= 3 and char_length(initials) > 0),
  score integer not null check (score >= 0),
  difficulty text not null check (difficulty in ('easy', 'hard')),
  mode text not null check (mode in ('classic', 'fixed', 'caverns', 'survival')),
  created_at timestamp with time zone default now(),
  
  -- Optional: track user if auth is added later
  user_id uuid references auth.users(id) on delete set null
);

-- Create indexes for fast leaderboard queries
create index idx_scores_mode_score on public.scores(mode, score desc);
create index idx_scores_created_at on public.scores(created_at desc);

-- Enable RLS
alter table public.scores enable row level security;

-- RLS Policy: Anyone can read scores (public leaderboard)
create policy "Anyone can view scores"
  on public.scores
  for select
  to public
  using (true);

-- RLS Policy: Anyone can insert scores (no auth required)
create policy "Anyone can submit scores"
  on public.scores
  for insert
  to public
  with check (true);

-- Prevent manipulation of existing scores
create policy "No updates allowed"
  on public.scores
  for update
  to public
  using (false);

create policy "No deletes allowed"
  on public.scores
  for delete
  to public
  using (false);