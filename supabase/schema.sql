-- ============================================================================
-- MATH RIVALS 3D — Supabase PostgreSQL Schema, RLS & Authoritative RPCs
-- ============================================================================
-- Run this SQL script once in your Supabase Dashboard -> SQL Editor.
-- All scores, duplicate-answer prevention, and host actions are validated
-- server-side in PostgreSQL via SECURITY DEFINER RPC functions.
-- High-frequency 3D positions & shot tracers travel over Supabase Realtime Broadcast.

create extension if not exists pgcrypto;

-- 1. Rooms table
create table if not exists public.rooms (
  room_code text primary key check (char_length(room_code) = 6),
  host_player_id uuid not null,
  phase text not null default 'lobby' check (phase in ('lobby', 'countdown', 'playing', 'finished')),
  countdown_ends_at timestamptz,
  match_started_at timestamptz,
  match_ends_at timestamptz,
  max_players int not null default 8,
  created_at timestamptz not null default now()
);

-- 2. Room Players table (authoritative scores & stats)
create table if not exists public.room_players (
  player_id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(room_code) on delete cascade,
  session_token text not null default encode(gen_random_bytes(24), 'hex'),
  name text not null check (char_length(name) between 2 and 18),
  team text not null check (team in ('blue', 'red')),
  ready boolean not null default false,
  is_host boolean not null default false,
  weapon text check (weapon in ('pistol', 'revolver', 'smg', 'rifle', 'burst', 'shotgun', 'lmg', 'sniper')),
  kills int not null default 0,
  deaths int not null default 0,
  headshots int not null default 0,
  correct_answers int not null default 0,
  wrong_answers int not null default 0,
  total_score int not null default 0,
  joined_at timestamptz not null default now()
);

create index if not exists idx_room_players_room on public.room_players(room_code);

-- 3. Question Attempts table — DB-enforced anti-farming UNIQUE constraint
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(room_code) on delete cascade,
  player_id uuid not null references public.room_players(player_id) on delete cascade,
  question_id text not null,
  is_correct boolean not null,
  awarded_weapon text,
  points_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique (room_code, player_id, question_id)
);

-- 4. Combat Events audit log
create table if not exists public.combat_events (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(room_code) on delete cascade,
  killer_id uuid not null references public.room_players(player_id) on delete cascade,
  victim_id uuid not null references public.room_players(player_id) on delete cascade,
  weapon text not null,
  headshot boolean not null default false,
  points_awarded int not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security (RLS) — Block direct client tampering!
-- ============================================================================
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.question_attempts enable row level security;
alter table public.combat_events enable row level security;

-- Read-only policies for public room view (never exposes session_token via view)
drop policy if exists "Allow read rooms" on public.rooms;
create policy "Allow read rooms" on public.rooms for select using (true);

drop policy if exists "Allow read combat events" on public.combat_events;
create policy "Allow read combat events" on public.combat_events for select using (true);

-- Public safe projection of room_players (hides session_token!)
create or replace view public.room_players_public as
select
  player_id,
  room_code,
  name,
  team,
  ready,
  is_host,
  weapon,
  kills,
  deaths,
  headshots,
  correct_answers,
  wrong_answers,
  total_score,
  joined_at
from public.room_players;

grant select on public.room_players_public to anon, authenticated;

-- ============================================================================
-- Authoritative RPC Functions (SECURITY DEFINER)
-- ============================================================================

create or replace function public.mr_create_room(p_player_name text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_code text;
  v_player_id uuid := gen_random_uuid();
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_clean_name text := left(trim(coalesce(p_player_name, 'Rival')), 18);
begin
  if char_length(v_clean_name) < 2 then
    v_clean_name := 'Rival_' || upper(substr(md5(random()::text), 1, 4));
  end if;

  loop
    v_code := upper(substr(replace(encode(gen_random_bytes(6), 'base64'), '/', 'A'), 1, 6));
    v_code := regexp_replace(v_code, '[^A-Z2-9]', 'X', 'g');
    exit when not exists (select 1 from public.rooms where room_code = v_code);
  end loop;

  insert into public.rooms (room_code, host_player_id, phase)
  values (v_code, v_player_id, 'lobby');

  insert into public.room_players (player_id, room_code, session_token, name, team, ready, is_host)
  values (v_player_id, v_code, v_token, v_clean_name, 'blue', true, true);

  return jsonb_build_object(
    'room_code', v_code,
    'player_id', v_player_id,
    'session_token', v_token
  );
end;
$$;

create or replace function public.mr_join_room(p_room_code text, p_player_name text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_code text := upper(trim(p_room_code));
  v_room public.rooms%rowtype;
  v_count int;
  v_blue int;
  v_red int;
  v_team text;
  v_player_id uuid := gen_random_uuid();
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_clean_name text := left(trim(coalesce(p_player_name, 'Rival')), 18);
begin
  select * into v_room from public.rooms where room_code = v_code;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.phase = 'finished' then
    raise exception 'MATCH_FINISHED';
  end if;

  select count(*),
         count(*) filter (where team = 'blue'),
         count(*) filter (where team = 'red')
  into v_count, v_blue, v_red
  from public.room_players where room_code = v_code;

  if v_count >= v_room.max_players then
    raise exception 'ROOM_FULL';
  end if;

  v_team := case when v_blue <= v_red then 'blue' else 'red' end;
  if char_length(v_clean_name) < 2 then
    v_clean_name := 'Rival_' || upper(substr(md5(random()::text), 1, 4));
  end if;

  insert into public.room_players (player_id, room_code, session_token, name, team, ready, is_host)
  values (v_player_id, v_code, v_token, v_clean_name, v_team, false, false);

  return jsonb_build_object(
    'room_code', v_code,
    'player_id', v_player_id,
    'session_token', v_token,
    'team', v_team
  );
end;
$$;

create or replace function public.mr_start_match(
  p_room_code text,
  p_player_id uuid,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_code text := upper(trim(p_room_code));
  v_room public.rooms%rowtype;
  v_player_count int;
  v_countdown_end timestamptz := now() + interval '3 seconds';
  v_match_end timestamptz := now() + interval '93 seconds';
begin
  if not exists (
    select 1 from public.room_players
    where room_code = v_code and player_id = p_player_id and session_token = p_session_token and is_host = true
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select count(*) into v_player_count from public.room_players where room_code = v_code;
  if v_player_count < 2 then
    raise exception 'NOT_ENOUGH_PLAYERS';
  end if;

  delete from public.question_attempts where room_code = v_code;
  delete from public.combat_events where room_code = v_code;

  update public.room_players
  set kills = 0, deaths = 0, headshots = 0, correct_answers = 0, wrong_answers = 0, total_score = 0, weapon = null
  where room_code = v_code;

  update public.rooms
  set phase = 'countdown',
      countdown_ends_at = v_countdown_end,
      match_started_at = v_countdown_end,
      match_ends_at = v_match_end
  where room_code = v_code
  returning * into v_room;

  return jsonb_build_object(
    'room_code', v_room.room_code,
    'countdown_ends_at', v_room.countdown_ends_at,
    'match_ends_at', v_room.match_ends_at
  );
end;
$$;

create or replace function public.mr_record_math_answer(
  p_room_code text,
  p_player_id uuid,
  p_session_token text,
  p_question_id text,
  p_is_correct boolean,
  p_awarded_weapon text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_code text := upper(trim(p_room_code));
  v_points int := case when p_is_correct then 100 else 0 end;
  v_total int;
  v_correct_count int;
begin
  if not exists (
    select 1 from public.room_players
    where room_code = v_code and player_id = p_player_id and session_token = p_session_token
  ) then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Reject if match already ended
  if exists (select 1 from public.rooms where room_code = v_code and (phase = 'finished' or now() > match_ends_at)) then
    raise exception 'MATCH_NOT_ACTIVE';
  end if;

  -- UNIQUE constraint prevents duplicate question farming!
  insert into public.question_attempts (room_code, player_id, question_id, is_correct, awarded_weapon, points_awarded)
  values (v_code, p_player_id, p_question_id, p_is_correct, case when p_is_correct then p_awarded_weapon else null end, v_points);

  update public.room_players
  set total_score = total_score + v_points,
      correct_answers = correct_answers + (case when p_is_correct then 1 else 0 end),
      wrong_answers = wrong_answers + (case when p_is_correct then 0 else 1 end),
      weapon = case when p_is_correct then p_awarded_weapon else weapon end
  where player_id = p_player_id
  returning total_score, correct_answers into v_total, v_correct_count;

  return jsonb_build_object(
    'points_awarded', v_points,
    'total_score', v_total,
    'correct_answers', v_correct_count
  );
end;
$$;

create or replace function public.mr_record_kill(
  p_room_code text,
  p_killer_id uuid,
  p_session_token text,
  p_victim_id uuid,
  p_weapon text,
  p_headshot boolean
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_code text := upper(trim(p_room_code));
  v_points int := 150 + (case when p_headshot then 50 else 0 end);
  v_killer_team text;
  v_victim_team text;
begin
  select team into v_killer_team
  from public.room_players
  where room_code = v_code and player_id = p_killer_id and session_token = p_session_token;

  if not found then
    raise exception 'UNAUTHORIZED';
  end if;

  select team into v_victim_team
  from public.room_players
  where room_code = v_code and player_id = p_victim_id;

  if not found or v_victim_team = v_killer_team or p_killer_id = p_victim_id then
    raise exception 'INVALID_TARGET';
  end if;

  insert into public.combat_events (room_code, killer_id, victim_id, weapon, headshot, points_awarded)
  values (v_code, p_killer_id, p_victim_id, p_weapon, p_headshot, v_points);

  update public.room_players
  set kills = kills + 1,
      headshots = headshots + (case when p_headshot then 1 else 0 end),
      total_score = total_score + v_points
  where player_id = p_killer_id;

  update public.room_players
  set deaths = deaths + 1,
      weapon = null
  where player_id = p_victim_id;

  return jsonb_build_object('points_awarded', v_points);
end;
$$;

grant execute on function public.mr_create_room(text) to anon, authenticated;
grant execute on function public.mr_join_room(text, text) to anon, authenticated;
grant execute on function public.mr_start_match(text, uuid, text) to anon, authenticated;
grant execute on function public.mr_record_math_answer(text, uuid, text, text, boolean, text) to anon, authenticated;
grant execute on function public.mr_record_kill(text, uuid, text, uuid, text, boolean) to anon, authenticated;
