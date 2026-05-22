-- MindTheGap policy & wealth schema.
-- Run this in the Supabase SQL Editor (Policy Making tab).
-- Run supabase_schema.sql first to create the government-data tables.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- wealth_distribution
-- Federal Reserve / DFA-style wealth share data by category and date.
-- ---------------------------------------------------------------------------
create table if not exists public.wealth_distribution (
  id           bigserial primary key,
  date         date        not null,
  category     text        not null,   -- e.g. "Top 1%", "Bottom 50%"
  net_worth    numeric,
  income       numeric,
  assets       numeric,
  liabilities  numeric,
  real_estate  numeric,
  equity       numeric,
  pension      numeric,
  unit         text        not null default 'USD_billions',
  source       text        not null default 'Federal Reserve DFA',
  fetched_at   timestamptz not null default now(),
  raw          jsonb       not null default '{}'::jsonb,
  constraint wealth_distribution_unique unique (date, category, source)
);

create index if not exists idx_wealth_distribution_category
  on public.wealth_distribution (category, date desc);

create index if not exists idx_wealth_distribution_date
  on public.wealth_distribution (date desc);

-- ---------------------------------------------------------------------------
-- demographics
-- Wealth breakdown by demographic group (race, age, education, generation).
-- ---------------------------------------------------------------------------
create table if not exists public.demographics (
  id           bigserial primary key,
  type         text        not null,   -- "race" | "age" | "education" | "generation"
  group_name   text        not null,   -- e.g. "Black", "25-34", "Bachelor"
  location     text,                   -- optional state / region
  date         date        not null,
  net_worth    numeric,
  income       numeric,
  assets       numeric,
  liabilities  numeric,
  share_of_total numeric,              -- % of total wealth
  unit         text        not null default 'USD_billions',
  source       text        not null default 'Federal Reserve DFA',
  fetched_at   timestamptz not null default now(),
  raw          jsonb       not null default '{}'::jsonb
);

-- Ensure columns exist in case the table was created by an older schema
alter table public.demographics
  add column if not exists source text not null default 'Federal Reserve DFA';
alter table public.demographics
  add column if not exists fetched_at timestamptz not null default now();
alter table public.demographics
  add column if not exists raw jsonb not null default '{}'::jsonb;

create unique index if not exists demographics_unique
  on public.demographics (type, group_name, date, coalesce(location, ''), source);

create index if not exists idx_demographics_type_group
  on public.demographics (type, group_name, date desc);

create index if not exists idx_demographics_location
  on public.demographics (location, date desc);

-- ---------------------------------------------------------------------------
-- economic_indicators
-- BLS / Census / FRED indicators keyed by state + date.
-- ---------------------------------------------------------------------------
create table if not exists public.economic_indicators (
  id                 bigserial primary key,
  state              text        not null,   -- two-letter code, upper-case
  county             text,
  date               date        not null,
  unemployment_rate  numeric,
  labor_force        bigint,
  employed           bigint,
  median_income      numeric,
  poverty_rate       numeric,
  gdp                numeric,
  gdp_growth         numeric,
  inflation_rate     numeric,
  source             text        not null default 'BLS/Census/FRED',
  fetched_at         timestamptz not null default now(),
  raw                jsonb       not null default '{}'::jsonb
);

-- Ensure columns exist in case the table was created by an older schema
alter table public.economic_indicators
  add column if not exists source text not null default 'BLS/Census/FRED';
alter table public.economic_indicators
  add column if not exists fetched_at timestamptz not null default now();
alter table public.economic_indicators
  add column if not exists raw jsonb not null default '{}'::jsonb;

create unique index if not exists economic_indicators_unique
  on public.economic_indicators (state, coalesce(county, ''), date, source);

create index if not exists idx_economic_indicators_state
  on public.economic_indicators (state, date desc);

-- ---------------------------------------------------------------------------
-- trend_cache
-- Pre-computed trend analysis results to avoid redundant API calls.
-- ---------------------------------------------------------------------------
create table if not exists public.trend_cache (
  id          bigserial primary key,
  metric      text        not null,
  date        timestamptz not null default now(),
  analysis    jsonb       not null default '{}'::jsonb,
  cached_at   timestamptz not null default now()
);

create index if not exists idx_trend_cache_metric
  on public.trend_cache (metric, date desc);

-- ---------------------------------------------------------------------------
-- policy_recommendations
-- Structured policy records queryable by economic context (Gini, poverty).
-- ---------------------------------------------------------------------------
create table if not exists public.policy_recommendations (
  id                     bigserial primary key,
  policy_key             text        not null unique,
  title                  text        not null,
  category               text        not null,
  description            text,
  target_populations     text[]      not null default '{}',
  expected_impact        text,
  implementation_difficulty text,
  cost_estimate          text,
  historical_examples    text[]      not null default '{}',
  success_metrics        text[]      not null default '{}',
  prerequisites          text[]      not null default '{}',
  gini_coefficient_min   numeric     not null default 0,
  gini_coefficient_max   numeric     not null default 1,
  poverty_rate_min       numeric     not null default 0,
  poverty_rate_max       numeric     not null default 100,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  raw                    jsonb       not null default '{}'::jsonb
);

create index if not exists idx_policy_recommendations_gini
  on public.policy_recommendations (gini_coefficient_min, gini_coefficient_max);

create index if not exists idx_policy_recommendations_category
  on public.policy_recommendations (category);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Drop-then-recreate so this script is safe to re-run (PostgreSQL has no
-- CREATE OR REPLACE POLICY, so we guard with DROP POLICY IF EXISTS).
-- ---------------------------------------------------------------------------

-- wealth_distribution
alter table public.wealth_distribution enable row level security;
drop policy if exists "Enable read for all users"        on public.wealth_distribution;
drop policy if exists "Enable insert for authenticated users" on public.wealth_distribution;
drop policy if exists "Enable update for authenticated users" on public.wealth_distribution;
create policy "Enable read for all users"
  on public.wealth_distribution for select using (true);
create policy "Enable insert for authenticated users"
  on public.wealth_distribution for insert
  with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users"
  on public.wealth_distribution for update
  using (auth.role() = 'authenticated');

-- demographics
alter table public.demographics enable row level security;
drop policy if exists "Enable read for all users"        on public.demographics;
drop policy if exists "Enable insert for authenticated users" on public.demographics;
drop policy if exists "Enable update for authenticated users" on public.demographics;
create policy "Enable read for all users"
  on public.demographics for select using (true);
create policy "Enable insert for authenticated users"
  on public.demographics for insert
  with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users"
  on public.demographics for update
  using (auth.role() = 'authenticated');

-- economic_indicators
alter table public.economic_indicators enable row level security;
drop policy if exists "Enable read for all users"        on public.economic_indicators;
drop policy if exists "Enable insert for authenticated users" on public.economic_indicators;
drop policy if exists "Enable update for authenticated users" on public.economic_indicators;
create policy "Enable read for all users"
  on public.economic_indicators for select using (true);
create policy "Enable insert for authenticated users"
  on public.economic_indicators for insert
  with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users"
  on public.economic_indicators for update
  using (auth.role() = 'authenticated');

-- trend_cache
alter table public.trend_cache enable row level security;
drop policy if exists "Enable read for all users"        on public.trend_cache;
drop policy if exists "Enable insert for authenticated users" on public.trend_cache;
create policy "Enable read for all users"
  on public.trend_cache for select using (true);
create policy "Enable insert for authenticated users"
  on public.trend_cache for insert
  with check (auth.role() = 'authenticated');

-- policy_recommendations
alter table public.policy_recommendations enable row level security;
drop policy if exists "Enable read for all users"        on public.policy_recommendations;
drop policy if exists "Enable insert for authenticated users" on public.policy_recommendations;
drop policy if exists "Enable update for authenticated users" on public.policy_recommendations;
create policy "Enable read for all users"
  on public.policy_recommendations for select using (true);
create policy "Enable insert for authenticated users"
  on public.policy_recommendations for insert
  with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users"
  on public.policy_recommendations for update
  using (auth.role() = 'authenticated');

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_policy_recommendations_updated_at
  on public.policy_recommendations;

create trigger trg_policy_recommendations_updated_at
  before update on public.policy_recommendations
  for each row execute function public.set_updated_at();
