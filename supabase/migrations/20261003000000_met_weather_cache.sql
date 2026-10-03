-- Shared destination forecast cache. Deploy only with an approved rollout;
-- MET weather remains disabled until config, contact and cache are verified.
create table if not exists public.met_weather_cache (
  cache_key text primary key,
  payload jsonb,
  expires_at timestamptz,
  last_modified text,
  fetched_at timestamptz,
  lock_until timestamptz not null default '-infinity',
  constraint met_cache_key_length check (length(cache_key) <= 80)
);
alter table public.met_weather_cache enable row level security;
revoke all on public.met_weather_cache from public, anon, authenticated;
grant select, insert, update, delete on public.met_weather_cache to service_role;

create or replace function public.claim_met_weather_cache(p_cache_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into public.met_weather_cache(cache_key) values(p_cache_key)
    on conflict (cache_key) do nothing;
  update public.met_weather_cache set lock_until = now() + interval '15 seconds'
    where cache_key = p_cache_key and lock_until <= now();
  return found;
end;
$$;
revoke all on function public.claim_met_weather_cache(text) from public, anon, authenticated;
grant execute on function public.claim_met_weather_cache(text) to service_role;
