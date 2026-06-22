# Creative Auditor App Purpose Statement

## Purpose

Creative Auditor is an internal creative intelligence application for collecting, organizing, evaluating, and comparing advertising creative across brands, campaigns, and channels.

The app exists to help teams answer practical creative questions:

- What creative assets do we have for a brand or campaign?
- Which channels are represented or missing?
- How do campaigns compare across brands and competitors?
- What does the current creative library look like at a glance?
- Which assets are strong, weak, incomplete, duplicated, or ready for review?

Creative Auditor is not a media buying platform, trafficking system, DAM replacement, or source-of-truth for spend. It is a creative audit and analysis layer that brings creative assets, platform metadata, campaign context, and human review into one readable workspace.

## Primary Users

The app is designed for strategy, creative, media, analytics, and client-service teams who need to inspect creative output across multiple sources without jumping between platform tools.

Primary workflows include:

- Building a brand-level creative library.
- Grouping assets into campaigns.
- Uploading or ingesting new creative.
- Capturing landing page and website screenshots.
- Reviewing channel coverage.
- Creating competitive comparison snapshots.
- Scoring creative with structured human evaluation.
- Syncing selected creative records from PMG Alli sources.

## In Scope

The app owns the following product surfaces:

- Brand management.
- Campaign management.
- Creative library management.
- Manual creative upload.
- Source ingestion from supported APIs and public metadata endpoints.
- Website and landing page screenshot capture.
- Thumbnail and preview management.
- Channel coverage and gap analysis.
- Competitive sets and competitive snapshots.
- Creative scorecards and structured review.
- App-level API connection settings.

The app owns the following data responsibilities:

- Maintaining normalized brand, campaign, creative, asset, metric, and evaluation records.
- Preserving raw ingestion lineage where possible.
- Storing enough source metadata to explain where each creative came from.
- Separating raw source capture from app-ready records and reporting-ready tables.
- Making data names understandable to humans who are not database specialists.

## Out of Scope

The app should not become:

- A replacement for PMG Alli, Supabase, platform ad managers, or a digital asset manager.
- A media activation, bidding, pacing, or trafficking tool.
- A platform spend, billing, or attribution source of truth.
- A long-term raw warehouse for every available external API field unless that data supports creative audit, lineage, or reporting.
- A black-box automation system where users cannot tell which API or source produced a result.

When a requested feature belongs primarily to another system, Creative Auditor may link to it, ingest a curated subset from it, or summarize its creative-relevant data, but should avoid duplicating the full external product.

## Data Sources

Creative Auditor may ingest or reference data from the following source groups.

### Human-entered app data

- Brands.
- Campaigns.
- Competitor sets.
- Creative titles and assignments.
- Hero creative selections.
- Scorecards, comments, tags, and human evaluations.

### Manual uploads

- Image files.
- Video files.
- PDFs.
- HTML5 or zip-based programmatic display assets.
- Generated video thumbnails.
- Supabase Storage file metadata.

Manual upload data should preserve the original file name, MIME type, storage path, upload job, and promotion path into app-ready creative records.

### Website and landing page capture

- User-provided website or landing page URLs.
- Headless-browser screenshot output.
- Snapshot timestamp.
- Screenshot storage path and thumbnail URL.
- Navigation or bot-wall failure details when capture fails.

Website screenshots represent point-in-time evidence. They should not overwrite older captures of the same page unless the user explicitly asks for replacement behavior.

### Platform and social sources

Supported channel and platform sources include:

- YouTube video URLs.
- YouTube channel ingestion.
- Meta or Facebook creative sources.
- Instagram media sources.
- TikTok video sources.
- Pinterest pin and profile sources.

Each platform integration should store source identifiers, canonical source URLs, source timestamps, thumbnails when available, and raw metadata sufficient for debugging and lineage.

### PMG Alli sources

The app may connect to PMG Alli through the Alli MCP/OAuth integration for selected creative-relevant data, including:

- Digital Asset Manager assets.
- Brand Media assets.
- Creative Studio assets.
- Other Alli MCP prefixes when they support creative audit use cases.

Alli-derived records should retain the MCP prefix, tool name, request context, source IDs, and enough response metadata to explain how the record entered the app.

### Derived and reporting data

The app may create derived tables and views for:

- Channel coverage.
- Campaign creative mix.
- Competitive comparisons.
- Scorecard summaries.
- Dashboard totals.
- Brand and campaign library views.

Derived data should be reproducible from Bronze and Silver records, or explicitly marked as human-entered evaluation data.

## Source of Truth Principles

- Raw source payloads belong in Bronze tables.
- Cleaned app entities belong in Silver tables.
- Dashboard-ready facts, dimensions, and reports belong in Gold tables or views.
- Supabase Storage is the source of truth for uploaded binary assets, while database tables store paths, metadata, and lineage.
- External APIs remain the source of truth for external platform state; Creative Auditor stores observed snapshots for audit and comparison.
- Human review and scorecard data is first-party app data and should be treated as durable Gold-layer business output.

## Success Criteria

The app is successful when a user can:

- Understand what creative exists for a brand or campaign.
- See which source produced each asset.
- Trust that raw, cleaned, and reporting data are separated.
- Read table and field names without needing tribal knowledge.
- Inspect API-driven actions in the UI before and after they run.
- Compare campaigns and competitors without manually rebuilding spreadsheets.
- Add new sources without weakening lineage, naming consistency, or user trust.

