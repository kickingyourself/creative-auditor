# Creative Auditor

Creative Auditor is an internal creative intelligence application for collecting, organizing, evaluating, and comparing advertising creative across brands, campaigns, and channels.

The app exists to help teams answer practical creative questions:

- What creative assets do we have for a brand or campaign?
- Which channels are represented or missing?
- How do campaigns compare across brands and competitors?
- What does the current creative library look like at a glance?
- Which assets are strong, weak, incomplete, duplicated, or ready for review?

Creative Auditor is not a media buying platform, trafficking system, DAM replacement, or source-of-truth for spend. It is a creative audit and analysis layer that brings creative assets, platform metadata, campaign context, and human review into one readable workspace.

---

## Technical Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (RLS-enforced) |
| File Storage | Supabase Storage (`creative-assets` bucket) |
| Screenshot Capture | Playwright Core + Sparticuz Chromium (serverless) |
| Deployment | Vercel |
| Icons | Lucide React |

---

## Data Sources

Creative Auditor ingests and references creative data from the following source groups.

### Human-entered app data
Brand records, campaign records, competitor sets, creative titles, hero creative selections, scorecards, comments, and tags.

### Manual uploads
Image, video, PDF, and HTML5/zip display creative files uploaded directly through the app. Stored in Supabase Storage with Bronze lineage tracked in `src_ingest_jobs` and `src_manual_uploads`.

### Website and landing page capture
Headless-browser screenshots of user-provided URLs using Playwright and Chromium. Snapshots are timestamped and stored in Supabase Storage. Older captures are preserved unless the user explicitly replaces them.

### Platform and social sources
| Platform | Source type |
|---|---|
| YouTube | Video URL metadata + channel ingestion |
| Meta / Facebook | Ad creative metadata |
| Instagram | Media sources |
| TikTok | Video metadata |
| Pinterest | Pin and profile metadata |

### PMG Alli integration
Selected creative-relevant data from Alli via MCP/OAuth, including Digital Asset Manager assets, Brand Media assets, and Creative Studio assets. Alli-derived records retain MCP tool name, source IDs, and response metadata for lineage.

### Derived and reporting data
Channel coverage views, campaign creative mix, competitive comparisons, scorecard summaries, and dashboard totals. Derived data is reproducible from Bronze and Silver records, or explicitly marked as human-entered evaluation.

---

## Schema Overview

The database follows a Medallion architecture (Bronze → Silver → Gold).

| Layer | Tables | Purpose |
|---|---|---|
| **Bronze** | `src_ingest_jobs`, `src_manual_uploads`, `src_youtube_videos` | Raw source capture, append-only, ingest lineage |
| **Silver** | `brands`, `campaigns`, `creatives` | Cleaned, normalized, app-ready entities |
| **Gold** | `dim_competitor_sets`, `dim_competitor_set_members`, `eval_creative_scorecards`, coverage views | Reporting, competitive benchmarking, human evaluation |

Core Silver entities:

- **Brand** — root entity; all campaigns and creatives are scoped to a brand
- **Campaign** — named grouping of creatives with optional date range
- **Creative** — individual ad unit with platform, source URL, thumbnail, and ingest lineage
- **Creative Asset** — file or media object attached to a creative
- **Ingest Job** — Bronze control record for every ingest run (upload, API pull, scrape, Alli sync)
- **Competitor Set** — named brand grouping for competitive benchmarking
- **Scorecard** — structured human evaluation of a creative across concept, craft, brand fit, message, and CTA dimensions

Supported platform types: `youtube`, `tiktok`, `meta`, `instagram`, `pinterest`, `landing_page`, `programmatic`, `ooh`, `tvc`, `social`.

---

## Documentation

| Document | Description |
|---|---|
| [Governance and Architecture Principles](docs/development-principles.md) | Medallion data architecture, naming conventions, API transparency rules, security principles, and the decision standard for feature additions |
| [Scope Statement](docs/auditor-scope-statement.md) | What the app owns, what it doesn't own, primary users, in-scope surfaces, out-of-scope boundaries, and success criteria |
| [Roadmap](docs/roadmap.md) | *(not yet written — placeholder only)* |

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Requires a `.env.local` file with Supabase project URL, anon key, and service role key. See `.env` for the expected variable names.
