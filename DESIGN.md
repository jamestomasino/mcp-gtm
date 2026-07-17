# MCP-GTM: Google Tag Manager MCP Server

## Overview

An MCP (Model Context Protocol) server that lets LLMs interact with Google Tag Manager through **exported JSON container files**. The server reads, validates, queries, and generates GTM container JSON exports, giving the LLM structured access to tags, triggers, variables, folders, and built-in variables without any API credentials or network calls.

**Why JSON files instead of the GTM API?**
- Zero auth setup (no GCP project, no service account, no OAuth)
- Fully offline and testable
- GTM export JSON is the canonical representation of a container
- Works with any container the user has access to (they just export it from GTM UI)
- Changes are diffable and version-controllable
- Import back into GTM is a single click in the UI

---

## 1. GTM Export JSON Structure

### Top-Level Shape

```json
{
  "exportTime": "2026-07-16T10:00:00.000Z",
  "containerVersion": {
    "accountId": "12345678",
    "containerId": "87654321",
    "containerVersionId": "42",
    "fingerprint": "abc123",
    "tagManagerUrl": "https://tagmanager.google.com/#/container/accounts/...",
    "container": { "name": "My Site", "usageContext": [1], "defaultTimezone": "America/New_York" },
    "tag": [ ... ],
    "trigger": [ ... ],
    "variable": [ ... ],
    "folder": [ ... ],
    "builtInVariable": [ ... ],
    "customTemplate": [ ... ],
    "client": [ ... ],
    "zone": [ ... ],
    "transformation": [ ... ],
    "gtagConfig": [ ... ]
  }
}
```

### Key Entity Shapes (abbreviated)

**Tag**
```json
{
  "tagId": "42",
  "fingerprint": "xyz",
  "name": "GA4 Page View",
  "type": "gaawe",
  "enabled": true,
  "parameter": [ { "key": "configurationId", "value": "G-XXXXXXXX" }, ... ],
  "firingTriggerId": [ "10", "11" ],
  "blockingTriggerId": [],
  "parentFolderId": "5",
  "notes": "Fires on every page view"
}
```

**Trigger**
```json
{
  "triggerId": "10",
  "name": "All Pages",
  "type": "pageview",
  "filter": [
    {
      "type": "equals",
      "parameter": [
        { "key": "arg0", "type": "field", "value": { "field": "pagePath" } },
        { "key": "arg1", "type": "template", "value": "/thank-you" }
      ]
    }
  ],
  "parentFolderId": "3"
}
```

**Variable**
```json
{
  "variableId": "7",
  "name": "Page URL",
  "type": "u",
  "parameter": [
    { "key": "dataLayerVersion", "value": "2" },
    { "key": "urlField", "value": { "field": "HOST" } }
  ]
}
```

### Entity Type Codes

| Code | Meaning |
|------|---------|
| Tag types | `gaawe` (GA4 Event), `googtag` (Google Tag), `html` (Custom HTML), `ua` (UA), `awct` (Ads Conversion), `img` (Custom Image), `cvt_*` (Custom Template) |
| Trigger types | `pageview`, `click`, `form`, `scroll`, `timer`, `custom`, `historyChange`, `domReady`, `error` |
| Variable types | `v` (Data Layer), `u` (URL), `jsm` (Custom JS), `smm` (Lookup Table), `remm` (RegEx Table), `c` (Constant), `k` (Cookie), `d` (DOM), `gas` (GA Settings) |

### Validation Findings

**No standalone GTM JSON validation library exists** (searched npm, PyPI, GitHub). The best existing validation tooling is:

1. **stape-io/google-tag-manager-mcp-server** — Comprehensive Zod schemas for all GTM entities (Tag, Trigger, Variable, ContainerVersion, Folder, etc.). Apache 2.0 licensed. These schemas map directly to the GTM API v2 resource shapes, which match the export JSON format.
2. **1nVitr0/plugin-vscode-gtm-editor** — TypeScript types for the GTM export format (GtmExport, GtmTag, GtmTrigger, GtmVariable, etc.) plus a content provider that parses/validates exports.
3. **Google's discovery document** — `https://tagmanager.googleapis.com/$discovery/rest?version=v2` has the canonical REST schema but it's not a ready-to-use validator.

**Decision**: Reuse stape-io's Zod schemas (Apache 2.0) as our validation backbone, adapt them for the export JSON wrapper shape. This gives us typed validation without building schemas from scratch.

---

## 2. What We Need to Build

### Core Components

| Component | Purpose |
|-----------|---------|
| **MCP Server** | JSON-RPC 2.0 server exposing tools via stdio transport |
| **GTM Schema Layer** | Zod schemas (adapted from stape-io) for validating container JSON |
| **Container Store** | In-memory container state loaded from a JSON file path |
| **Tool Definitions** | Structured tool schemas with typed parameters and descriptions |
| **Testing Suite** | Unit tests with real GTM export fixtures, snapshot tests |
| **Documentation** | README, tool usage examples, setup guide |

### Language Choice

**TypeScript/Node.js** — MCP SDK is TypeScript-first, Zod schemas are native TypeScript, and distribution via npm is straightforward.

### Project Structure

```
mcp-gtm/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP server entry point (stdio transport)
│   ├── store.ts              # ContainerStore class (load, state, export)
│   ├── schemas/              # Adapted Zod schemas from stape-io
│   │   ├── index.ts          # Re-export all schemas
│   │   ├── export.ts         # GtmExportSchema (wrapper: exportTime + containerVersion)
│   │   ├── tag.ts            # TagSchema
│   │   ├── trigger.ts        # TriggerSchema
│   │   ├── variable.ts       # VariableSchema
│   │   ├── folder.ts         # FolderSchema
│   │   ├── container.ts      # ContainerSchema
│   │   ├── parameter.ts      # ParameterSchema (shared, used by tag/trigger/variable)
│   │   └── condition.ts      # ConditionSchema (shared, used by trigger filters)
│   ├── tools/                # One file per tool or grouped by domain
│   │   ├── container.ts      # load_container, get_container_info, get_container_state
│   │   ├── tags.ts           # list_tags, get_tag, create_tag, update_tag, delete_tag, find_tags_by_type
│   │   ├── triggers.ts       # list_triggers, get_trigger, create_trigger, update_trigger, delete_trigger
│   │   ├── variables.ts      # list_variables, get_variable, create_variable, update_variable, delete_variable, list_builtin_variables
│   │   ├── folders.ts        # list_folders, get_folder
│   │   ├── analysis.ts       # get_tag_dependencies, find_unused_entities, find_orphaned_triggers, validate_container
│   │   └── export.ts         # export_container, diff_containers
│   └── utils/
│       ├── entity.ts         # helpers: resolveTriggerName, resolveFolderName, nextId
│       └── typeCodes.ts      # tag/trigger/variable type code → human-readable name map
├── tests/
│   ├── fixtures/             # Real GTM export JSON files (anonymized)
│   │   ├── simple.json       # Small web container
│   │   └── complex.json      # Larger container with folders
│   ├── schemas.test.ts       # Zod validation tests
│   ├── store.test.ts         # ContainerStore tests
│   ├── tools/                # Per-tool tests
│   │   ├── container.test.ts
│   │   ├── tags.test.ts
│   │   └── ...
│   └── integration.test.ts   # MCP protocol round-trip tests
└── README.md
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework (stdio transport) |
| `zod` | Schema validation (reused from stape-io) |
| `tsx` | TypeScript execution (dev + build) |
| `vitest` | Test runner |

### Build Tool

**tsx** for dev execution, **tsc** for production builds. Keep it simple — no bundler needed.

---

## 3. Tool Design

### Design Principles

1. **File-loaded, not API-called**: Server loads a container JSON file at startup. All tools operate on the in-memory state.
2. **Read-heavy, write-with-export**: Most interactions are read/inspect. Write tools mutate in-memory state and produce a new export file.
3. **Validation on every write**: Zod schemas validate entities before they're accepted into the container state.
4. **Entity references are resolved**: When listing tags, trigger IDs are resolved to trigger names.
5. **Idempotent reads**: List, get, and inspect tools are safe to retry.

### Proposed Tool Catalog

#### Container & Inspection (read-only)

| Tool | Description |
|------|-------------|
| `gtm_load_container` | Load a GTM container JSON file (called once at start or to swap containers) |
| `gtm_get_container_info` | Get container metadata (name, ID, timezone, platform) |
| `gtm_get_container_state` | Get summary counts and structure overview |

#### Tags

| Tool | Description |
|------|-------------|
| `gtm_list_tags` | List all tags with summary info (name, type, status, folder) |
| `gtm_get_tag` | Get full tag configuration by tag_id or name |
| `gtm_create_tag` | Create a new tag (validated, auto-assigns tagId) |
| `gtm_update_tag` | Update an existing tag |
| `gtm_delete_tag` | Delete a tag from the container |
| `gtm_find_tags_by_type` | Find all tags of a given type (e.g. all GA4 tags) |

#### Triggers

| Tool | Description |
|------|-------------|
| `gtm_list_triggers` | List all triggers with summary info |
| `gtm_get_trigger` | Get full trigger configuration |
| `gtm_create_trigger` | Create a new trigger |
| `gtm_update_trigger` | Update an existing trigger |
| `gtm_delete_trigger` | Delete a trigger |

#### Variables

| Tool | Description |
|------|-------------|
| `gtm_list_variables` | List user-defined variables |
| `gtm_get_variable` | Get variable details |
| `gtm_create_variable` | Create a variable |
| `gtm_update_variable` | Update a variable |
| `gtm_delete_variable` | Delete a variable |
| `gtm_list_builtin_variables` | List enabled built-in variables |

#### Folders

| Tool | Description |
|------|-------------|
| `gtm_list_folders` | List folders in the container |
| `gtm_get_folder` | Get folder details and entity membership |

#### Analysis & Queries

| Tool | Description |
|------|-------------|
| `gtm_get_tag_dependencies` | Show which triggers/variables a tag references |
| `gtm_find_unused_entities` | Find tags, triggers, or variables not referenced by anything |
| `gtm_find_orphaned_triggers` | Find triggers not fired by any tag |
| `gtm_validate_container` | Run full Zod validation, report all issues |

#### Export

| Tool | Description |
|------|-------------|
| `gtm_export_container` | Write current container state to a JSON file |
| `gtm_diff_containers` | Compare two container JSON files, report differences |

### Tool Parameter Conventions

```typescript
// Tools that load a container take a file path:
{
  file_path: string,    // path to GTM export JSON file
}

// Read tools operate on the loaded container (no extra params needed).
// Write tools accept entity identifiers:
{
  tag_id?: string,      // or trigger_id, variable_id, folder_id
  name?: string,        // alternative lookup by name
}

// Example list response (entity references resolved):
{
  tags: [
    {
      tag_id: "42",
      name: "GA4 Page View",
      type: "gaawe",
      enabled: true,
      firing_trigger_ids: ["10", "11"],
      firing_trigger_names: ["All Pages", "DOM Ready"],
      folder_id: "5",
      folder_name: "Analytics",
    }
  ],
  total_count: 24,
}
```

---

## 4. Architecture

```
┌─────────────────────────────────────────────┐
│  LLM Client (Claude, Cursor, Jcode, etc.)   │
└──────────────┬──────────────────────────────┘
               │ MCP (JSON-RPC 2.0)
               │ stdio transport
               ▼
┌─────────────────────────────────────────────┐
│  MCP-GTM Server                             │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │  Tool       │  │  Schema Layer        │  │
│  │  Registry   │  │  (Zod, from stape-io) │  │
│  └──────┬──────┘  └──────────┬───────────┘  │
│         │                    │               │
│  ┌──────▼────────────────────▼────────────┐  │
│  │  Container Store (in-memory)           │  │
│  │  - Loaded from GTM export JSON file    │  │
│  │  - Tags, Triggers, Variables, Folders  │  │
│  │  - Built-in Variables, Custom Templates│  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  GTM Export JSON files    │
   │  (local filesystem)       │
   └───────────────────────────┘
```

### Key Design Decisions

- **No network calls**: Everything operates on local JSON files. The user exports their GTM container from the UI and points the server at it.
- **In-memory state**: Container is loaded once into memory. Write tools mutate state. Export tool writes it back out.
- **Zod validation on writes**: Every create/update passes through the adapted stape-io Zod schemas before being accepted.
- **Entity resolution**: Trigger IDs in tags are resolved to trigger names in list responses for readability.
- **Auto ID assignment**: When creating entities, the server auto-assigns the next available ID based on existing max.

---

## 5. Testing Strategy

### Test Fixtures

- Real GTM export JSON files (anonymized) covering:
  - A simple web container (few tags/triggers/variables)
  - A complex production container (many entities, folders, custom templates)
  - A server-side container (zones, clients, transformations)

### Unit Tests

- Tool parameter validation (missing file path, invalid entity IDs)
- Zod schema validation (valid/invalid tag, trigger, variable payloads)
- Entity CRUD operations (create, read, update, delete, auto-ID assignment)
- Entity reference resolution (trigger IDs → names)
- Export round-trip (load → modify → export → reload → compare)

### Snapshot Tests

- Capture expected tool responses for each fixture
- Regression protection when tool output format changes

### Integration Tests

- Full MCP protocol round-trips (tool call → response) using the MCP SDK test harness
- Multi-step workflows: load → inspect → create tag → validate → export

---

## 6. Publishing & Distribution

### Package
- Publish to **npm** as `mcp-gtm`
- Entry point: `node dist/index.js` (stdio MCP server)
- Dependencies: `@modelcontextprotocol/sdk`, `zod`

### MCP Client Configuration

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "gtm": {
      "command": "npx",
      "args": ["-y", "mcp-gtm"],
      "env": {
        "GTM_CONTAINER_FILE": "/path/to/your-container.json"
      }
    }
  }
}
```

**Jcode / Cursor**: Same structure in MCP server config.

---

## 7. How the LLM Engages With It

### Typical Workflows

**Inspect a container:**
```
User: "What tags do we have in our GTM container?"
LLM → gtm_load_container(file_path="container.json")
     → gtm_list_tags() → returns tag inventory with resolved trigger names
     → Summarizes findings to user
```

**Debug a missing tag fire:**
```
User: "Why isn't our checkout event firing?"
LLM → gtm_list_triggers() → finds checkout trigger config
     → gtm_get_trigger(trigger_id="15") → checks conditions, filters
     → gtm_list_tags() → finds tags referencing that trigger
     → gtm_get_tag_dependencies(tag_id="22") → traces full dependency chain
     → Identifies misconfiguration
```

**Create a new tag:**
```
User: "Add a GA4 purchase event tag triggered on checkout confirmation"
LLM → gtm_create_trigger(name="Checkout Confirmation", type="custom", ...)
     → gtm_create_tag(name="GA4 Purchase", type="gaawe",
         firing_trigger_ids=["<new-trigger-id>"], ...)
     → gtm_validate_container() → confirms no issues
     → gtm_export_container(file_path="container-updated.json")
     → Reports: "Export written to container-updated.json, ready to import into GTM"
```

**Audit and cleanup:**
```
User: "Find all disabled tags and orphaned triggers"
LLM → gtm_list_tags() → filters enabled=false
     → gtm_find_orphaned_triggers() → finds unused triggers
     → gtm_find_unused_entities() → full audit
     → Presents cleanup recommendations
```

**Compare containers:**
```
User: "What changed between our staging and prod containers?"
LLM → gtm_diff_containers(file_a="staging.json", file_b="prod.json")
     → Reports: 3 new tags, 2 modified triggers, 1 deleted variable
```

### Safety Guards

1. **Validation on every write**: Zod rejects invalid entities before they enter state
2. **No live impact**: Edits only affect in-memory state; user must explicitly export
3. **Idempotency**: Re-running a create with same name is detected and handled

---

## 8. Implementation Plan

### Phase 1: Foundation ✅ COMPLETE
- [x] Scaffold TypeScript project with MCP SDK
- [x] Adapt stape-io Zod schemas for export JSON wrapper
- [x] Build container store (load, in-memory state)
- [x] Build read-only tools (load, list tags/triggers/variables, get entity)
- [x] Add test fixtures and unit tests

### Phase 2: Write Operations ✅ COMPLETE
- [x] Tag CRUD tools with validation
- [x] Trigger CRUD tools with validation
- [x] Variable CRUD tools with validation
- [x] Folder CRUD tools (create, delete, move_tag_to_folder)
- [x] Export tool (write state to JSON file)
- [x] Round-trip tests (load → modify → export → reload)

### Phase 3: Analysis & Polish ✅ COMPLETE
- [x] Analysis tools (dependencies, unused entities, orphaned triggers)
- [x] Container diff tool
- [x] Full validation tool
- [x] Documentation and README
- [x] MCP Resources (4: container_state, tags, triggers, variables)
- [x] MCP Prompts (5: inspect, audit, debug, compare, audit_consent)
- [x] Per-tool unit tests (12 test groups, 181 tests)
- [x] MCP protocol integration tests (7 tests)
- [x] Read-only mode via `GTM_READ_ONLY` env var
- [ ] Publish to npm

### Phase 4: Advanced ✅ COMPLETE
- [x] Server-side GTM entities (zones, clients, transformations) — schemas, store getters, 6 read tools
- [x] Folder management improvements (move triggers/variables to folders) — 2 new tools
- [x] Custom template support — schema, store getter, 2 read tools
- [x] Lifecycle tools (firing order, consent analysis, tag lifecycle) — 3 tools
- [x] Read-only mode config flag (`GTM_READ_ONLY` env var)

---

## Status Update (2026-07-17)

### Build Health
- **Tests**: 181 / 181 passing (14 test files)
- **Build**: Clean TypeScript compilation, Biome linter passes
- **Git**: On `main`

### Implementation Status

#### Phase 1: Foundation — ✅ COMPLETE
- [x] Scaffold TypeScript project with MCP SDK
- [x] Zod schemas (export, tag, trigger, variable, folder, container, parameter, condition, customTemplate, serverSide)
- [x] ContainerStore (load, in-memory state, CRUD, export, validate)
- [x] Read-only tools (load, list tags/triggers/variables, get entity)
- [x] Test fixtures (`simple.json`, `complex.json`, `consent.json`, `workspace-format.json`) and unit tests

#### Phase 2: Write Operations — ✅ COMPLETE
- [x] Tag CRUD tools with validation (list, get, create, update, delete, find_by_type)
- [x] Trigger CRUD tools with validation (list, get, create, update, delete)
- [x] Variable CRUD tools with validation (list, get, create, update, delete, list_builtin)
- [x] Folder tools (list, get, create, delete, move_tag_to_folder)
- [x] Export tool (write state to JSON file)
- [x] Round-trip tests (load → modify → export → reload)

#### Phase 3: Analysis & Polish — ✅ COMPLETE
- [x] Analysis tools (dependencies, unused entities, orphaned triggers, validate)
- [x] Container diff tool
- [x] Full validation tool
- [x] MCP Resources (4: container_state, container_tags, container_triggers, container_variables)
- [x] MCP Prompts (5: inspect_container, audit_container, debug_tag, compare_containers, audit_consent)
- [x] Auto-load from `GTM_CONTAINER_FILE` env var
- [x] README.md with full documentation
- [x] Per-tool unit tests (12 test groups, 181 tests)
- [x] MCP protocol integration tests (7 tests)
- [x] Read-only mode via `GTM_READ_ONLY` env var
- [x] Workspace export format normalization
- [ ] Publish to npm

#### Phase 4: Advanced — ✅ COMPLETE
- [x] Server-side GTM entities (zones, clients, transformations) — schemas, store getters, 6 read tools
- [x] Folder management improvements (move triggers/variables to folders) — 2 new tools
- [x] Custom template support — schema, store getter, 2 read tools
- [x] Lifecycle tools (tag firing order, consent setup analysis, per-tag lifecycle) — 3 tools
- [x] Read-only mode config flag (`GTM_READ_ONLY` env var)

### Tool Inventory (44 tools, 4 resources, 5 prompts)

All tools are implemented and registered in `src/index.ts`. The tool groups are:

| Group | File | Tools |
|-------|------|-------|
| Container | `tools/container.ts` | load_container, get_container_info, get_container_state |
| Tags | `tools/tags.ts` | list_tags, get_tag, create_tag, update_tag, delete_tag, find_tags_by_type |
| Triggers | `tools/triggers.ts` | list_triggers, get_trigger, create_trigger, update_trigger, delete_trigger |
| Variables | `tools/variables.ts` | list_variables, get_variable, create_variable, update_variable, delete_variable, list_builtin_variables |
| Folders | `tools/folders.ts` | list_folders, get_folder, create_folder, delete_folder, move_tag_to_folder, move_trigger_to_folder, move_variable_to_folder |
| Analysis | `tools/analysis.ts` | get_tag_dependencies, find_unused_entities, find_orphaned_triggers, validate_container |
| Lifecycle | `tools/lifecycle.ts` | analyze_tag_firing_order, analyze_consent_setup, get_tag_lifecycle |
| Server-Side | `tools/serverSide.ts` | list_zones, get_zone, list_clients, get_client, list_transformations, get_transformation, list_custom_templates, get_custom_template |
| Export | `tools/export.ts` | export_container, diff_containers |

### Where We Left Off

All planned phases are complete. The project has 44 tools, 4 resources, 5 prompts, and 181 passing tests.

**Next steps:**
1. **Publish to npm** — Finalize `package.json` and publish.
2. **CI/CD** — Add GitHub Actions for automated testing.
3. **Structured error handling** — Improve error categorization in tool responses.
4. **Undo/redo** — Add undo stack for in-memory mutations.
5. **Search tool** — Add full-text search across entity names and notes.

---

## 9. Open Questions

All original open questions have been resolved:

1. **Auto-load vs explicit load** → Both supported. `GTM_CONTAINER_FILE` env var auto-loads; `gtm_load_container` allows explicit swap.
2. **Multiple containers** → Single container at a time. Reload via `gtm_load_container` to swap.
3. **Read-only mode** → Implemented via `GTM_READ_ONLY` env var.
4. **Schema strictness** → Using `.passthrough()` — GTM exports may have extra fields not in the API schema.
5. **Entity type lookup** → Bundled in `utils/typeCodes.ts` with maps for tags, triggers, and variables.
