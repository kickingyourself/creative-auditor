# Creative Auditor Development Principles

## Purpose

This document defines the development principles for Creative Auditor. It should guide schema design, API work, UI behavior, and future feature additions.

The core idea is simple: the app should be transparent to users, readable to developers, and disciplined about data lineage.

## Medallion Architecture

Creative Auditor should follow a Bronze, Silver, and Gold data model.

### Bronze

Bronze tables preserve source truth.

Bronze data should be:

- Raw or minimally transformed.
- Append-only by default.
- Closely tied to an ingest job.
- Rich enough to debug source API behavior.
- Explicit about source system, source record ID, source URL, raw payload, and capture time.

Bronze tables should not be shaped around UI convenience. They exist to answer: "What exactly did we receive, when, and from where?"

Preferred examples:

```text
bronze.ingest_jobs
bronze.manual_upload_assets_raw
bronze.youtube_videos_raw
bronze.meta_ads_raw
bronze.instagram_media_raw
bronze.tiktok_videos_raw
bronze.pinterest_pins_raw
bronze.alli_assets_raw
bronze.web_screenshots_raw
```

If separate schemas are not practical, use prefixes:

```text
brz_ingest_jobs
brz_manual_upload_assets_raw
brz_youtube_videos_raw
```

### Silver

Silver tables hold cleaned, conformed, app-ready records.

Silver data should be:

- Deduplicated.
- Normalized across sources.
- Stable enough for app pages and API routes.
- Explicit about canonical IDs, app-owned IDs, source lineage, and lifecycle state.
- Free from source-specific naming unless a source-specific concept is required.

Silver tables answer: "What does the app know this thing is?"

Preferred examples:

```text
silver.brands
silver.campaigns
silver.creatives
silver.creative_assets
silver.creative_metrics
silver.ingest_runs
silver.platform_accounts
```

If separate schemas are not practical:

```text
slv_brands
slv_campaigns
slv_creatives
slv_creative_assets
```

### Gold

Gold tables and views hold analytics-ready business outputs.

Gold data should be:

- Designed for dashboards, comparisons, and reporting.
- Easy to query without heavy app-side reshaping.
- Named around business concepts.
- Rebuildable from Bronze and Silver unless it represents human evaluation.

Gold answers: "What does the business need to know or decide?"

Preferred examples:

```text
gold.dim_brand
gold.dim_campaign
gold.dim_channel
gold.dim_platform
gold.dim_date
gold.dim_competitor_set
gold.fct_creative
gold.fct_creative_metric_daily
gold.fct_channel_coverage
gold.fct_campaign_creative_mix
gold.fct_creative_scorecard
gold.rpt_dashboard_overview
gold.rpt_brand_library
gold.rpt_campaign_detail
gold.rpt_competitive_coverage
```

If separate schemas are not practical:

```text
dim_brand
dim_campaign
fct_creative
fct_channel_coverage
rpt_dashboard_overview
```

## Table Naming Conventions

Use names that communicate layer, entity, and purpose.

### General Rules

- Use lowercase snake_case.
- Prefer full words over unclear abbreviations.
- Use singular nouns for dimensions: `dim_brand`, not `dim_brands`.
- Use event or process names for facts: `fct_creative_metric_daily`.
- Use `_raw` suffix only for Bronze source-capture tables.
- Use `_daily`, `_weekly`, or `_monthly` suffixes when grain matters.
- Use `_snapshot` only when records represent a point-in-time capture.
- Avoid names that encode UI layout, such as `card_data` or `modal_items`.

### Layer Prefixes

Use one of these patterns consistently.

Preferred schema pattern:

```text
bronze.<source>_<entity>_raw
silver.<domain>_<entity>
gold.dim_<entity>
gold.fct_<business_process>
gold.rpt_<report_name>
```

Acceptable public-schema pattern:

```text
brz_<source>_<entity>_raw
slv_<domain>_<entity>
dim_<entity>
fct_<business_process>
rpt_<report_name>
```

Do not mix both patterns casually.

## Column Naming Conventions

Column names should be readable by a human scanning a query result.

### Identifier Columns

- Use `<entity>_id` for app-owned primary keys when clarity matters.
- Use `id` only when the table name already makes the entity obvious.
- Use `source_<entity>_id` for external IDs.
- Use `ingest_job_id` for Bronze lineage.
- Use `creative_id`, `brand_id`, and `campaign_id` consistently across layers.

Examples:

```text
creative_id
brand_id
campaign_id
source_video_id
source_asset_id
ingest_job_id
```

### Time Columns

Use names that explain the event:

```text
created_at
updated_at
ingested_at
received_at
captured_at
posted_at
first_seen_at
last_seen_at
submitted_at
finished_at
```

Avoid vague names like `date`, `timestamp`, or `time`.

### URL and Storage Columns

Keep platform URLs and storage paths separate.

```text
canonical_source_url
source_url
thumbnail_url
storage_bucket
storage_path
raw_file_path
preview_image_path
```

Do not use `source_url` for both external platform URLs and Supabase Storage URLs unless preserving legacy compatibility.

### Status Columns

Status values should be short, explicit, and documented.

Examples:

```text
status: pending | running | done | partial | error
creative_status: processing | active | archived | error
```

Avoid status values that describe UI state rather than data state.

## Human Readability Principles

Data names should be understandable to a strategist, analyst, or engineer without a private glossary.

Use:

```text
brand_name
campaign_name
channel_key
platform_key
ad_type
file_format
creative_status
score_brand_fit
score_call_to_action
```

Avoid:

```text
bn
camp_nm
plt
typ
stat
misc
data
payload2
thing_id
```

Raw payloads may preserve external API names inside JSONB, but app-owned tables should use app-owned readable names.

## API Transparency in the UI

Users should understand when the app is calling an external API, what source is being queried, and what happened.

For every user-triggered ingest or sync flow, the UI should show:

- Source system, such as YouTube, Pinterest, Meta, TikTok, Alli, manual upload, or website screenshot.
- Action being performed, such as "fetch video metadata", "create signed upload URL", or "sync Alli assets".
- Required credentials or connection status.
- Inputs being sent, such as URL, brand, campaign, channel, or date range.
- Progress state.
- Success count, duplicate count, and error count.
- Human-readable error messages.
- Link or reference to the created records when possible.

API-backed UI should not hide important source behavior behind generic loading text. Prefer specific messages:

```text
Fetching YouTube video metadata
Creating Supabase signed upload URLs
Saving 4 uploaded files as creative assets
Refreshing Alli token
Pinterest oEmbed did not return a thumbnail
```

Avoid vague messages:

```text
Working
Syncing data
Something went wrong
Processing request
```

## Ingest and Lineage Principles

Every ingest flow should create or reference an ingest job.

An ingest job should capture:

- Source system.
- Triggering action.
- Request inputs.
- Actor or app context when available.
- Start time.
- Finish time.
- Status.
- Asset count.
- Promoted count.
- Error detail.

Every promoted Silver record should retain lineage back to Bronze where practical:

```text
ingest_job_id
source_system
source_record_id
source_url
bronze_record_id
```

If a source does not provide a stable ID, record the canonical URL and a generated source fingerprint.

## App Naming Conventions

Use the same domain language across database tables, API routes, TypeScript types, and UI labels.

Preferred domain terms:

```text
Brand
Campaign
Creative
Creative Asset
Channel
Platform
Ingest Job
Scorecard
Competitor Set
Competitive Snapshot
Coverage
Metric
Source
```

Avoid introducing near-synonyms unless they represent different concepts. For example, do not use `asset`, `creative`, `file`, and `item` interchangeably in app-owned code.

Recommended distinctions:

- `creative`: the ad unit or concept being audited.
- `creative_asset`: a file or media object attached to a creative.
- `source_record`: the original external record.
- `metric`: measured performance or platform metadata.
- `scorecard`: human evaluation.
- `snapshot`: a point-in-time saved comparison.

## API Route Principles

API routes should be explicit about:

- Authentication requirements.
- Input schema.
- Source system.
- Side effects.
- Returned record IDs.
- Error codes.

Route handlers should avoid each defining their own Supabase setup when shared helpers can enforce consistent auth and configuration.

Use structured error responses:

```json
{
  "error": "Failed to persist creative to the database.",
  "code": "SUPABASE_INSERT_ERROR",
  "detail": "duplicate key value violates unique constraint"
}
```

Avoid raw or inconsistent error shapes across routes.

## Security and Access Principles

- Bronze write access should be server-only.
- Silver write access should go through app-controlled APIs or server actions.
- Gold reporting views may be broadly readable inside the app, but Gold writes should be controlled.
- Service-role Supabase keys must never be imported into client components.
- Public API routes must be intentionally listed and documented.
- External tokens should be stored server-side only and never echoed to the browser.

## UI Development Principles

The UI should make data lineage visible without making users read database terms.

Good UI labels:

```text
Source: YouTube
Ingested from: Manual Upload
Last synced: Jun 3, 2026
Raw source: Pinterest oEmbed
Storage: Supabase creative-assets
```

Avoid exposing internal names directly:

```text
brz_youtube_videos_raw
fct_creative_metric_daily
src_ingest_jobs
```

Internal names belong in admin/debug panels, tooltips, logs, or developer views.

## Documentation Principles

Any new source or major workflow should update documentation with:

- Purpose.
- Source system.
- Required environment variables.
- Bronze table.
- Silver promotion path.
- Gold outputs.
- UI surfaces.
- Failure modes.

Documentation should describe the current app, not starter-template behavior.

## Implementation Order for Medallion Compliance

1. Define schemas or prefixes and choose one naming pattern.
2. Move or map existing `src_*` tables into Bronze conventions.
3. Split current creative storage and creative identity into Silver `creatives` and `creative_assets`.
4. Move performance fields into Silver or Gold metric facts.
5. Add Gold dimensions and facts for dashboard and competitive use cases.
6. Point app dashboards to Gold reporting views.
7. Regenerate Supabase types for all tables and views.
8. Replace ad hoc `as any` casts with typed models.
9. Add UI transparency to every ingest flow.
10. Document every source and route that can write data.

## Decision Standard

When adding or changing a feature, ask:

- What layer does this data belong to?
- Can a human understand the table and column names?
- Can a user see which API or source produced the result?
- Is raw source truth preserved?
- Is app-ready data separated from reporting-ready data?
- Can this be debugged without reading every route handler?

If the answer to any of these is no, slow down and improve the model before expanding the feature.

