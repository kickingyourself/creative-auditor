

# Alli MCP Servers — Setup & Technical Guide
**Updated Apr 24**
Alli MCP Servers — Setup & Technical Guide

By Maxwell Thomason

Overview

The Alli MCP (Model Context Protocol) Backend is a production server that automatically converts all Alli platform OpenAPI specs into callable MCP tools. This means any AI coding assistant that supports MCP (Claude Code, Claude Desktop, Cursor, etc.) can directly interact with the full Alli API surface — datasources, GenDash, workflows, central, data explorer, and 13 more services — without writing any API integration code.

Repository: AgencyPMG/alli-mcp-backend (private) • Stack: Node.js 18+ / TypeScript / Express 4 / @modelcontextprotocol/sdk
Why It Matters

Zero integration code — Every Alli API endpoint becomes a callable tool automatically. No SDKs, no HTTP clients, no auth boilerplate.
Hundreds of tools — 109 tools from alli_central alone; hundreds more across all 18 specs.
Live API access — Query datasources, create GenDash dashboards, manage workflows, look up clients — all from your AI assistant.
OAuth handled automatically — Claude Code manages the full OAuth 2.1 + PKCE flow. Just configure the URL and go.
Architecture

The server reads a specs.json configuration that defines 18 Alli API specs. At startup, it fetches each OpenAPI spec, parses all paths and methods, and registers them as MCP tools. Each spec is mounted at its own URL prefix.
Request Flow

Client sends POST /mcp/generative_dashboards with Authorization: Bearer <token> and MCP JSON-RPC body
Server validates token against Alli Central /me endpoint
Looks up the MountedSpec for the requested prefix
Creates a fresh MCP Server + StreamableHTTPServerTransport (stateless — no session state)
For tools/call, matches tool name → builds upstream HTTP request (path params, query, headers, body)
Forwards the Bearer token to the upstream Alli API
Returns response as MCP text content
Key Design Decisions

Stateless — A new Server is created per request. No session persistence.
Token forwarding — The client's Bearer token is forwarded to every upstream API call. The server does not store tokens.
Hot-reload — POST /reload/:prefix re-fetches the OpenAPI spec without server restart. With Redis, broadcasts to all instances.
Error propagation — Failed tool calls return the error as MCP text content with isError: true (not thrown).
Available MCP Servers (18 Prefixes)

Each prefix is a separate MCP server endpoint. Configure only the ones you need for your use case.
Prefix
Domain
Base URL
Common Use Cases
alli_central
Users, clients, orgs, auth
api.central.alliplatform.com
Client lookup, user management, permissions
actions
Workflow actions
api.actions.alliplatform.com
Trigger workflows, list action templates
brand_media
Brand media assets
brandmedia.alliplatform.com
Upload/manage brand assets
categorizations
Categorization rules
categorizations.alliplatform.com/api
Manage categorization rules
cloud_storage
File storage
storage.central.alliplatform.com
Upload/download files
creative_insights
Creative analytics
api.creative.alliplatform.com
Analyze creative performance
creative_studio
Creative authoring
creativestudio.alliplatform.com
Create/edit creatives
digital_asset_manager
DAM
assets.alliplatform.com
Manage digital assets
data
Datasource CRUD
data.alliplatform.com/api/v2
Create, list, update, delete datasources
data_explorer
Data Explorer queries
dataexplorer.alliplatform.com
Run queries, get models/fields
events
Event bus
events.central.alliplatform.com
Cross-service event management
generative_dashboards
GenDash CRUD
generativedashboards.alliplatform.com/api
Create/update dashboards and charts
media_planner
Media planning
mediaplanner.alliplatform.com/api
Create/edit media plans
partners
Partner integrations
partners.alliplatform.com
Manage partner connections
pixel
Pixel/tag management
api.pixel.alliplatform.com
Manage tracking pixels
products
Product feeds
api.feeds.alliplatform.com
Manage product feeds
sftp
SFTP operations
sftp-api.alliplatform.com
SFTP upload/download
slack
Slack integration
api.slack.alliplatform.com
Send messages, manage channels

Priority prefixes for Solutions work: data, data_explorer, generative_dashboards, alli_central, actions
Authentication

How Token Validation Works

Every MCP request requires Authorization: Bearer <token>
Server validates the token against Alli Central's /me endpoint using AlliApiAuthenticator
Returns AuthInfo with userId, email, and a 1-hour default expiry
The same Bearer token is forwarded to all upstream REST API calls
OAuth 2.1 + PKCE Flow (Automated)

Claude Code handles this automatically when using type: "url" configuration:
Client hits /mcp/:prefix without a token
Server responds 401 with WWW-Authenticate: Bearer resource_metadata="<host>/.well-known/oauth-protected-resource"
Client fetches Protected Resource Metadata → discovers authorization server
Client fetches /.well-known/oauth-authorization-server → gets real Alli OIDC metadata with DCR endpoint injected
Client calls POST /oauth/register (DCR shim) → gets pre-registered native OAuth client ID
Client opens browser to https://login.alliplatform.com/authorize?client_id=<id>&...
User logs in → Alli redirects back with auth code
Client exchanges code for Bearer token at https://login.alliplatform.com/token

Critical: The redirect URI must use 127.0.0.1 (NOT localhost). Alli Central's validator only applies port-flexible loopback matching to 127.0.0.1 and [::1].
DCR Shim

The Alli login server does not support Dynamic Client Registration (RFC 7591). The MCP server includes a shim at POST /oauth/register that satisfies MCP clients by returning a pre-registered native_app OAuth client ID.
Environment
Default DCR Client ID
Production
77e7f3ff-f1f4-416b-b66b-62ac76746eb1
Staging
988344d4-9906-4f1e-a801-f22947f7ea0e
Setup Instructions

Production vs Staging URLs

Environment
MCP Base URL
Login Domain
Production
https://mcp.alliplatform.com
https://login.alliplatform.com
Staging
https://mcp.allistaging.com
https://login.allistaging.com
Full URL pattern: https://mcp.alliplatform.com/mcp/<prefix>
Option A:  Claude Code or OpenCode — OAuth Flow (Recommended)

Update ~/.claude/.mcp.json for Claude Code or ~/.config/opencode/opencode.json for OpenCode.
Claude Code and OpenCode both handle the OAuth 2.1 + PKCE flow automatically — it opens a browser for Alli login on first use.
~/.claude/.mcp.json




{
  "mcpServers": {
    "alli_central": {
      "type": "url",
      "url": "https://mcp.alliplatform.com/mcp/alli_central"
    },
    "alli_data": {
      "type": "url",
      "url": "https://mcp.alliplatform.com/mcp/data"
    },
    "alli_data_explorer": {
      "type": "url",
      "url": "https://mcp.alliplatform.com/mcp/data_explorer"
    },
    "alli_generative_dashboards": {
      "type": "url",
      "url": "https://mcp.alliplatform.com/mcp/generative_dashboards"
    },
    "alli_actions": {
      "type": "url",
      "url": "https://mcp.alliplatform.com/mcp/actions"
    }
  }
}
~/.config/opencode/opencode.json




{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "alli_central": {
      "type": "remote",
      "url": "https://mcp.alliplatform.com/mcp/alli_central",
    },
    "alli_data": {
      "type": "remote",
      "url": "https://mcp.alliplatform.com/mcp/data"
    },
    "alli_data_explorer": {
      "type": "remote",
      "url": "https://mcp.alliplatform.com/mcp/data_explorer"
    },
    "alli_generative_dashboards": {
      "type": "remote",
      "url": "https://mcp.alliplatform.com/mcp/generative_dashboards"
    },
    "alli_actions": {
      "type": "remote",
      "url": "https://mcp.alliplatform.com/mcp/actions"
    }
  }
}
Option B: Claude Code or OpenCode — Manual Bearer Token

If you already have an Alli OAuth token (e.g., from browser DevTools):
~/.claude/.mcp.json (with token)




{
  "mcpServers": {
    "alli_central": {
      "type": "url",
      "url": "https://mcp.alliplatform.com/mcp/alli_central",
      "headers": {
        "Authorization": "Bearer <your-alli-oauth-token>"
      }
    }
  }
}
~/.config/opencode/opencode.json (with token)




{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "alli_central": {
      "type": "remote",
      "url": "https://mcp.alliplatform.com/mcp/alli_central",
      "headers": {
        "Authorization": "Bearer <your-alli-oauth-token>"
      }
    }
  }
}
Option C: Claude Desktop

Same URL format in Claude Desktop's MCP settings:
Claude Desktop config




{
  "mcpServers": {
    "alli_central": {
      "url": "http://127.0.0.1:3000/mcp/alli_central",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
Option D: mcp-remote (Legacy Fallback)

For older MCP clients that don't support type: "url":
mcp-remote config




{
  "mcpServers": {
    "alli_central": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.alliplatform.com/mcp/alli_central",
        "--host", "127.0.0.1"
      ]
    }
  }
}
The --host 127.0.0.1 flag is required because the Alli OAuth client's redirect URI is registered with 127.0.0.1.
Tool Naming & Input Schema

How Tools Are Named

Tools are auto-generated from each OpenAPI spec:
Uses operationId from the spec if present (sanitized, lowercased, max 64 chars)
Fallback: {method}_{path} with special chars replaced by _
Example: GET /users/{id} becomes get_users_id
Input Schema Convention

All parameters are flattened into a single JSON object:
Source
Placement in Tool Input
Path parameters
Top-level, by param name
Query parameters
Top-level, by param name
Header parameters
Top-level, by param name
requestBody (object)
Properties merged into top level
requestBody (non-object)
Single body key
Discovering Available Tools

To see all tools for a prefix, call tools/list on that MCP endpoint, or hit the health endpoint:
GET https://mcp.alliplatform.com/ — Lists all mounted specs and tool counts
GET https://mcp.alliplatform.com/health — Per-spec health status with tool counts
Common Operations Quick Reference

Datasources (prefix: data)

Operation
Likely Tool Name
Key Parameters
List datasources
get_project_projectid_datasources
projectId (= client UUID), limit, cursor
Create datasource shell
post_project_projectid_datasource_create
projectId, name, sourceType, sourceSchema
Fetch single datasource
get_datasource_datasourceid_fetch
datasourceId
Upsert + upload
post_client_projectid_datasource_upsert
projectId, datasource object, file
Edit datasource
patch_datasource_datasourceid_edit
datasourceId, updatable fields
Trigger sync
get_datasource_datasourceid_sync
datasourceId, optional date range
Check run info
get_project_projectid_datasources_runinfo
projectId, date
GenDash (prefix: generative_dashboards)

Operation
Likely Tool Name
Key Parameters
List dashboards
get_client_clientid_dashboards
clientId, page, size
Create from template
post_client_clientid_dashboard
clientId, name, userId, rows, defaultFilters
Create from AI prompt
post_client_clientid_dashboard_prompt
clientId, userPrompt, userId
Get dashboard
get_dashboard_dashboardid
dashboardId
Update dashboard
patch_dashboard_dashboardid
dashboardId, name, rows, filters
Delete dashboard
delete_dashboard_dashboardid
dashboardId (soft delete)
Create chart
post_client_clientid_chart
clientId, type, description, columns, chartCode
Update chart
patch_chart_chartid_edit
chartId, chartCode, type, columns
Delete chart
delete_chart_chartid
chartId (soft delete)
Central (prefix: alli_central)

Operation
Likely Tool Name
Notes
Get current user
get_me
Returns user info for the Bearer token
List clients
get_clients
All accessible clients
Get client by slug
get_clients_slug
Client details by slug

Tool names are derived from OpenAPI specs and may differ from the examples above. Use tools/list on the specific prefix to get exact tool names.
Use Cases

Alli MCP isn't just an API wrapper — it's a force multiplier across every discipline. Here's how different teams can leverage it.
🎯 Media & Activation

For media buyers, planners, and activation leads who need to move faster than the UI allows.
Use Case
How It Works
Prefixes Used
Cross-client pacing snapshot
Ask your AI assistant: "Show me spend pacing for all active datasources across Ralph Lauren, Fanatics, and Peter Millar." It queries data and data_explorer across multiple client contexts and returns a unified view — no tab-switching, no exports.
data, data_explorer, alli_central
Bulk creative asset audit
"Pull all brand media assets uploaded in the last 30 days and flag any missing alt text or incorrect dimensions." Scans the DAM and creative studio programmatically — work that would take hours in the UI.
brand_media, digital_asset_manager, creative_insights
Real-time campaign health checks
Before a client call, ask: "What's the status of all datasource syncs for [client] in the last 24 hours?" Instantly surface failed syncs, stale data, or broken pipelines without logging into Alli Data.
data, alli_central
Pixel & tag validation
"List all pixels for [client] and confirm each one has fired in the last 7 days." Cross-reference pixel management with event data to catch silent tracking failures before they become reporting gaps.
pixel, events
Media plan → datasource scaffolding
After finalizing a media plan, ask: "Create datasource shells for each channel in this media plan with the correct schema." Automatically scaffold the data infrastructure to match the plan — before the first dollar is spent.
media_planner, data
📊 Data & Analytics

For analysts who want to query, validate, and visualize without leaving their coding environment.
Use Case
How It Works
Prefixes Used
Natural language data exploration
"What columns are available in the promotions datasource for Peter Millar? Show me the last 5 rows where revenue > $10K." The AI translates intent into Data Explorer queries — no SQL, no UI navigation.
data_explorer, data
Schema drift detection
"Compare the current schema of [datasource] against our manifest definition and flag any mismatches." Catch column renames, type changes, or missing fields before they break downstream dashboards.
data
Automated QA after data loads
"After the daily sync completes, check that row counts are within 10% of yesterday and no date column has NULLs." Build validation checks that run conversationally — prototype QA logic before codifying it into workflow nodes.
data, data_explorer
Dashboard widget prototyping
"Create a Highcharts line chart showing weekly spend trend by channel and add it to the executive dashboard." Write the React component code in your IDE, push it to a GenDash chart — see the result in seconds, iterate in real-time.
generative_dashboards, data_explorer
Cross-datasource join exploration
"What fields do the promotions datasource and the email datasource have in common? Could we join them on date + brand?" Explore join possibilities across datasources without writing a single query.
data_explorer, data
Datasource inventory & cleanup
"List all datasources for [client] that haven't had a successful sync in 30+ days." Surface zombie datasources eating up resources, then archive them in the same conversation.
data
⚙️ Engineering & Platform

For engineers building solutions, debugging production issues, and maintaining infrastructure.
Use Case
How It Works
Prefixes Used
Deployment verification
"Verify that all datasources and GenDash dashboards defined in the promotion-tracking manifest exist for Ralph Lauren." One command replaces manually clicking through the Alli UI to confirm deployments.
data, generative_dashboards, alli_central
Live API prototyping
Before writing a new workflow node, prototype the API calls conversationally: "Create a test datasource with this schema, upload 10 rows, verify it appears in Data Explorer." Get the exact payloads right before codifying them.
data, data_explorer
Incident debugging
"A client's dashboard is showing stale data. Check the datasource sync status, last successful run, and whether the schema matches what the workflow outputs." Triage production issues without context-switching between 4 different Alli UI screens.
data, generative_dashboards, alli_central
Multi-client rollout validation
"For each client in [list], check if the standard executive dashboard exists and has all 6 required widgets." Validate rollouts across 50+ clients in one conversation instead of clicking through each one.
generative_dashboards, alli_central
SFTP pipeline monitoring
"List all SFTP jobs for [client] and show which ones failed in the last week." Monitor file-based integrations without SSH-ing into servers or digging through logs.
sftp, alli_central
Workflow orchestration from the IDE
"Trigger the daily-etl workflow for Peter Millar and stream the execution status." Kick off and monitor workflows without leaving your code editor — perfect for dev/test cycles.
actions, alli_central
Hot-swap GenDash widget code
"Update the revenue scorecard widget on [dashboard] with this new Highcharts component code." Push code changes to live dashboards instantly during development — no UI copy-paste.
generative_dashboards
🧠 Strategy & Client Solutions

For strategists, solutions architects, and client leads who need to move from idea to prototype in hours, not weeks.
Use Case
How It Works
Prefixes Used
Instant client onboarding audit
"What does [new client]'s current Alli setup look like? List their datasources, dashboards, active workflows, and connected partners." Get a complete picture of a client's platform footprint in seconds — essential before a strategy kickoff.
alli_central, data, generative_dashboards, actions, partners
Solution prototype in a conversation
"I want to build a promotion tracking solution for a new client. Create the input datasource, output datasource, and an empty GenDash dashboard with the right schema." Scaffold an entire solution architecture conversationally — then hand it off to engineering with real resource IDs.
data, generative_dashboards, alli_central
Competitive dashboard teardown
"Pull the widget code from [client]'s executive dashboard and analyze the chart types, data patterns, and filter logic." Reverse-engineer what's working for one client and adapt the patterns for another.
generative_dashboards, data_explorer
White-space analysis
"Which clients have datasources but no GenDash dashboards? Which have dashboards with fewer than 3 widgets?" Identify upsell and improvement opportunities across the entire client portfolio programmatically.
alli_central, data, generative_dashboards
RFP-ready capability inventory
"Generate a summary of all Alli capabilities we're currently using across clients — datasource types, dashboard counts, active workflow templates, partner integrations." Build a capability matrix for pitches and proposals without manual data collection.
alli_central, data, generative_dashboards, actions, partners
Solution impact measurement
"For the promotion tracking solution, pull dashboard view counts, datasource sync success rates, and workflow execution history for the last 90 days across all deployed clients." Quantify solution adoption and reliability for QBRs and roadmap prioritization.
generative_dashboards, data, actions, events
AI-powered dashboard generation
"Create a GenDash for [client] using AI: 'Executive overview showing spend, revenue, ROAS by channel with weekly trending.'" Use the prompt-based dashboard creation endpoint to go from English description to live dashboard in one call.
generative_dashboards
🔗 Cross-Discipline Power Moves

The real magic happens when you chain multiple prefixes together in a single conversation.
End-to-end solution deployment in one conversation
Discover — "What clients don't have the promotion tracking solution yet?" (alli_central + data + generative_dashboards)
Scaffold — "Create the input and output datasources for [client] using the standard schema" (data)
Build — "Create a GenDash dashboard with these 6 widgets" (generative_dashboards)
Validate — "Confirm all resources exist and the datasource schema matches the manifest" (data + data_explorer)
Notify — "Post to #solutions-deploys: Promotion tracking deployed for [client]" (slack)
What used to take 2 hours of UI clicking now takes one 5-minute conversation.
Automated client health report
List — "Get all active clients" (alli_central)
Scan — "For each client: count datasources, check last sync, count dashboards, count active workflows" (data + generative_dashboards + actions)
Analyze — "Flag any client with failed syncs in the last 48h or dashboards with 0 widgets"
Report — "Create a GenDash scorecard showing platform health metrics" (generative_dashboards)
A portfolio-wide health check that would take a full day becomes a repeatable 10-minute workflow.
Creative performance → dashboard pipeline
Pull — "Get creative performance data from the last 30 days" (creative_insights)
Enrich — "Cross-reference with brand media metadata for creative dimensions and formats" (brand_media)
Store — "Create an output datasource and load the enriched data" (data)
Visualize — "Build a GenDash with top performers, format breakdown, and trend charts" (generative_dashboards)
From raw creative data to a client-ready dashboard — entirely in conversation.
HTTP Endpoints Reference

Method
Path
Auth
Description
GET
/
None
List all mounted specs and tool counts
GET
/health
None
Per-spec health status (healthy/unhealthy, tool counts)
GET
/.well-known/oauth-protected-resource
None
OAuth 2.0 Protected Resource Metadata (RFC 9728)
GET
/.well-known/oauth-authorization-server
None
OIDC metadata with DCR endpoint injected
POST
/oauth/register
None
DCR shim — returns pre-registered native OAuth client ID
POST
/mcp/:prefix
Bearer
MCP JSON-RPC tool calls (Streamable HTTP)
GET
/mcp/:prefix
Bearer
MCP SSE stream
DELETE
/mcp/:prefix
Bearer
MCP session termination
POST
/reload/:prefix
Bearer
Re-fetch OpenAPI spec without restart
Troubleshooting



Connection failed or timeout


OAuth flow not triggering


401 Unauthorized


403 Forbidden


Tool not found


Server unhealthy
Integration with Existing Workflows

Alli MCP servers complement (don't replace) existing Alli patterns:
Use Case
Best Tool
Ad-hoc lookups (clients, datasources, dashboards)
MCP tools
Solution deployment (idempotent create-or-skip)
deployment_check.py
Scheduled/triggered data pipelines
Alli workflow nodes
Prototyping API calls before codifying
MCP tools
Debugging production datasource/GenDash issues
MCP tools
Bulk widget creation across clients
deployment_check.py + manifest
Local Development

Prerequisites

Node.js 18+
Docker (for local services: Valkey/Redis + Zipkin)
1Password CLI (op) + jq (for credential setup)
Quick Start




git clone <repo-url> && cd alli-mcp-server
./bin/dev/up       # Start Docker services + pull .env from 1Password + npm install
./bin/dev/serve    # Start server on http://127.0.0.1:3000
Environment Variables

Variable
Description
Default
Variable
Description
Default
CONFIG
Path to specs.json file
./specs.json
PORT
HTTP port
3000
HOST
Bind address
127.0.0.1
ALLI_ENV
Token validation env (staging, prod)
—
ALLI_APPLICATION_ID
Application UUID in Alli Central
—
APP_ENV
Controls OTel + OAuth domain
—
REDIS_URL
Redis for multi-instance reload signaling
—
Dev Scripts

Script
Description
./bin/dev/up
Start Docker + pull .env from 1Password + npm install
./bin/dev/serve
Start server locally (hot-reload via tsx)
./bin/dev/restart
down + up + serve
./bin/dev/down
Stop Docker services
