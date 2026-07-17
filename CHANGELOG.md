# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Biome linter and formatter for code quality
- Structured error responses with error categories (`not_loaded`, `not_found`, `validation`, `io`, `disabled`, `internal`)
- `consent_settings` field in tag lifecycle responses

### Changed
- Improved error handling: errors now return JSON with `category` and `message` fields instead of plain text

---

## [0.1.0] - 2026-07-16

### Added

#### Lifecycle & Consent Analysis
- `gtm_analyze_tag_firing_order` — deterministic firing order, sequencing dependencies, conflict detection
- `gtm_analyze_consent_setup` — consent pattern detection, issue classification, recommendations
- `gtm_get_tag_lifecycle` — per-tag lifecycle phase, consent relationships, issues
- `audit_consent` MCP prompt for consent compliance audits

#### Server-Side GTM
- `gtm_list_zones`, `gtm_get_zone` — zone management
- `gtm_list_clients`, `gtm_get_client` — client management
- `gtm_list_transformations`, `gtm_get_transformation` — transformation management
- `gtm_list_custom_templates`, `gtm_get_custom_template` — custom template support
- Full Zod schemas for server-side entities

#### Folder Management
- `gtm_move_trigger_to_folder` — move triggers between folders
- `gtm_move_variable_to_folder` — move variables between folders

#### Analysis
- `gtm_get_tag_dependencies` — trigger dependency tracing
- `gtm_find_unused_entities` — find unused tags, triggers, variables
- `gtm_find_orphaned_triggers` — find triggers not used by any tag
- `gtm_validate_container` — full Zod validation

#### Export & Diff
- `gtm_export_container` — export current state to JSON file
- `gtm_diff_containers` — compare two container files

#### MCP Resources (4)
- `gtm://container/state` — entity counts and metadata
- `gtm://container/tags` — full tag listing
- `gtm://container/triggers` — full trigger listing
- `gtm://container/variables` — full variable listing

#### MCP Prompts (5)
- `inspect_container` — list all entities with resolved names
- `audit_container` — find unused/orphaned/disabled entities
- `debug_tag` — debug why a specific tag isn't firing
- `compare_containers` — compare two container files
- `audit_consent` — audit consent setup and compliance

#### Configuration
- `GTM_CONTAINER_FILE` env var for auto-loading on startup
- `GTM_READ_ONLY` env var to disable all write tools
- Workspace export format normalization (handles entities at containerVersion level)

#### Core
- Tag CRUD tools with Zod validation
- Trigger CRUD tools with Zod validation
- Variable CRUD tools with Zod validation
- Folder CRUD tools
- Entity type code to human-readable name mapping
- 181 tests across 14 test files
