-- MindTheGap normalized government-data schema.
-- Run this in the Supabase SQL editor before using /api/admin/sync-government-data.

create extension if not exists pgcrypto;

create table if not exists public.source_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_written integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.state_metric_snapshots (
  id bigserial primary key,
  state_name text not null,
  state_fips text not null,
  metric_key text not null,
  metric_label text not null,
  value numeric,
  unit text,
  period text not null,
  source text not null,
  source_table text,
  source_url text,
  vintage_year integer,
  fetched_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  constraint state_metric_snapshots_unique unique (state_fips, metric_key, period, source)
);

create index if not exists idx_state_metric_snapshots_state
  on public.state_metric_snapshots (state_name, state_fips);

create index if not exists idx_state_metric_snapshots_metric
  on public.state_metric_snapshots (metric_key, period desc);

create table if not exists public.data_quality_issues (
  id bigserial primary key,
  state_name text,
  state_fips text,
  metric_key text,
  severity text not null default 'warning',
  issue_type text not null,
  message text not null,
  source text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists idx_data_quality_issues_state
  on public.data_quality_issues (state_name, state_fips, resolved_at);

create or replace view public.latest_state_metric_snapshots
  with (security_invoker = on)
as
select distinct on (state_fips, metric_key, source)
  id,
  state_name,
  state_fips,
  metric_key,
  metric_label,
  value,
  unit,
  period,
  source,
  source_table,
  source_url,
  vintage_year,
  fetched_at,
  raw
from public.state_metric_snapshots
where value is not null
order by state_fips, metric_key, source, period desc, fetched_at desc;
