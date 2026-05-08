-- ============================================================
-- Creative Audit Tool — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation (available by default in Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUM: platform
-- ============================================================
-- Defines the supported ad platforms / source surfaces.
-- 'homepage' covers brand website scrapes.
create type platform_type as enum (
  'youtube',
  'tiktok',
  'homepage',
  'social'
);

-- ============================================================
-- TABLE: brands
-- The root entity. All campaigns and creatives belong to a brand.
-- ============================================================
create table if not exists brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,                          -- optional; stored in creative-assets bucket
  website_url text,                          -- used as seed URL for homepage scraping
  created_at  timestamptz not null default now()
);

comment on table brands is 'Top-level brand entities. All campaigns and creatives are owned by a brand.';
comment on column brands.logo_url    is 'Public URL of the brand logo, typically from the creative-assets storage bucket.';
comment on column brands.website_url is 'Brand homepage URL used as the seed for homepage creative scraping.';

-- ============================================================
-- TABLE: campaigns
-- A campaign groups creatives under a named effort with a date range.
-- Always scoped to a single brand.
-- ============================================================
create table if not exists campaigns (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands (id) on delete cascade,
  name       text not null,
  start_date date,
  end_date   date,
  created_at timestamptz not null default now(),

  -- Enforce logical date ordering when both dates are supplied
  constraint campaigns_date_order check (
    start_date is null or end_date is null or start_date <= end_date
  )
);

comment on table campaigns is 'Named ad campaigns belonging to a brand, optionally spanning a date range.';
comment on column campaigns.brand_id   is 'The brand this campaign belongs to. Cascades on brand deletion.';
comment on column campaigns.start_date is 'Inclusive campaign start date (UTC). NULL means open-ended / unknown.';
comment on column campaigns.end_date   is 'Inclusive campaign end date (UTC). NULL means ongoing / unknown.';

-- ============================================================
-- TABLE: creatives
-- An individual ad creative asset (video, image, etc.).
-- Always belongs to a brand; optionally grouped under a campaign.
-- ============================================================
create table if not exists creatives (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands (id) on delete cascade,
  campaign_id     uuid references campaigns (id) on delete set null,  -- nullable — creative may be ungrouped
  platform        platform_type not null,
  source_url      text not null,                                      -- canonical URL of the ad (YouTube watch URL, TikTok share URL, etc.)
  thumbnail_url   text,                                               -- cached thumbnail stored in creative-assets bucket
  view_count      bigint check (view_count >= 0),                     -- null = not yet fetched; bigint for viral counts
  engagement_rate numeric(5, 4) check (                              -- e.g. 0.0342 = 3.42%; 4 decimal places
    engagement_rate >= 0 and engagement_rate <= 1
  ),
  created_at      timestamptz not null default now(),

  -- Prevent duplicate ingestion of the same URL per brand
  constraint creatives_source_url_brand_unique unique (brand_id, source_url),

  -- Ensure campaign_id's brand matches the creative's brand
  -- (enforced via trigger below; FK alone cannot cross-reference the same table)
  constraint creatives_campaign_not_null_when_id_set check (
    campaign_id is null or campaign_id is not null  -- placeholder; real enforcement is in the trigger
  )
);

comment on table creatives is 'Individual ad creatives ingested from YouTube, TikTok, brand homepages, or social platforms.';
comment on column creatives.brand_id        is 'Owning brand. Cascades on brand deletion.';
comment on column creatives.campaign_id     is 'Optional campaign grouping. Set to NULL on campaign deletion (set null).';
comment on column creatives.platform        is 'Source platform enum: youtube | tiktok | homepage | social.';
comment on column creatives.source_url      is 'Canonical URL of the creative. Unique per brand to prevent duplicate ingestion.';
comment on column creatives.thumbnail_url   is 'Cached thumbnail URL from the creative-assets Supabase Storage bucket.';
comment on column creatives.view_count      is 'Total view count at last sync. NULL if not yet fetched.';
comment on column creatives.engagement_rate is 'Engagement rate as a decimal (e.g. 0.0342 = 3.42%). NULL if not yet computed.';

-- ============================================================
-- TRIGGER: enforce campaign belongs to the same brand as creative
-- ============================================================
create or replace function check_campaign_brand_match()
returns trigger language plpgsql as $$
begin
  if new.campaign_id is not null then
    if not exists (
      select 1 from campaigns
      where id = new.campaign_id
        and brand_id = new.brand_id
    ) then
      raise exception
        'campaign_id % does not belong to brand_id %',
        new.campaign_id, new.brand_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger creatives_campaign_brand_check
  before insert or update on creatives
  for each row execute function check_campaign_brand_match();

-- ============================================================
-- INDEXES
-- ============================================================

-- Frequent filter: fetch all creatives for a brand
create index if not exists idx_creatives_brand_id
  on creatives (brand_id);

-- Frequent filter: fetch all creatives for a campaign
create index if not exists idx_creatives_campaign_id
  on creatives (campaign_id)
  where campaign_id is not null;

-- Frequent filter: fetch all campaigns for a brand
create index if not exists idx_campaigns_brand_id
  on campaigns (brand_id);

-- Frequent filter: filter creatives by platform
create index if not exists idx_creatives_platform
  on creatives (platform);

-- ============================================================
-- ROW-LEVEL SECURITY (RLS)
-- Enable RLS on all tables. Policies below grant anon/service access.
-- Tighten these once auth (Supabase Auth) is wired up.
-- ============================================================
alter table brands    enable row level security;
alter table campaigns enable row level security;
alter table creatives enable row level security;

-- Allow full public read for now (tighten with auth.uid() checks later)
create policy "public_read_brands"
  on brands for select using (true);

create policy "public_read_campaigns"
  on campaigns for select using (true);

create policy "public_read_creatives"
  on creatives for select using (true);

-- Service-role writes (insert/update/delete) bypass RLS by default in Supabase.
-- When you add user auth, replace 'true' with auth.role() = 'authenticated' or similar.

-- ============================================================
-- STORAGE: creative-assets bucket
-- ============================================================
-- Creates the storage bucket and sets a public read policy.
-- Run this block AFTER the tables above; it targets the storage schema.
-- In Supabase Studio you can alternatively create the bucket via the UI.

insert into storage.buckets (id, name, public)
values ('creative-assets', 'creative-assets', true)
on conflict (id) do nothing;

-- Allow anyone to read objects in this bucket (thumbnails, logos)
create policy "public_read_creative_assets"
  on storage.objects for select
  using (bucket_id = 'creative-assets');

-- Allow authenticated service-role uploads (tighten when user auth is added)
create policy "service_role_upload_creative_assets"
  on storage.objects for insert
  with check (bucket_id = 'creative-assets');
