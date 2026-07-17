# mcp-gtm

[![CI](https://github.com/jamestomasino/mcp-gtm/actions/workflows/ci.yml/badge.svg)](https://github.com/jamestomasino/mcp-gtm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/mcp-gtm.svg)](https://www.npmjs.com/package/mcp-gtm)

An MCP (Model Context Protocol) server that lets LLMs interact with Google Tag Manager through **exported JSON container files**. Zero auth setup, fully offline.

## Quick Start

```bash
npm install
npm run dev
```

Or configure in your MCP client:

```json
{
  "mcpServers": {
    "gtm": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-gtm/src/index.ts"],
      "env": {
        "GTM_CONTAINER_FILE": "/path/to/your-container.json"
      }
    }
  }
}
```

## Tools (47 total)

### Container
| Tool | Description |
|------|-------------|
| `gtm_load_container` | Load a GTM container JSON file |
| `gtm_get_container_info` | Get container metadata |
| `gtm_get_container_state` | Get summary counts |

### Tags
| Tool | Description |
|------|-------------|
| `gtm_list_tags` | List all tags |
| `gtm_get_tag` | Get tag by ID or name |
| `gtm_create_tag` | Create a new tag |
| `gtm_update_tag` | Update an existing tag |
| `gtm_delete_tag` | Delete a tag |
| `gtm_find_tags_by_type` | Find tags by type (e.g. gaawe) |

### Triggers
| Tool | Description |
|------|-------------|
| `gtm_list_triggers` | List all triggers |
| `gtm_get_trigger` | Get trigger by ID or name |
| `gtm_create_trigger` | Create a new trigger |
| `gtm_update_trigger` | Update a trigger |
| `gtm_delete_trigger` | Delete a trigger |

### Variables
| Tool | Description |
|------|-------------|
| `gtm_list_variables` | List user-defined variables |
| `gtm_get_variable` | Get variable details |
| `gtm_create_variable` | Create a variable |
| `gtm_update_variable` | Update a variable |
| `gtm_delete_variable` | Delete a variable |
| `gtm_list_builtin_variables` | List built-in variables |

### Folders
| Tool | Description |
|------|-------------|
| `gtm_list_folders` | List folders |
| `gtm_get_folder` | Get folder details |
| `gtm_create_folder` | Create a new folder |
| `gtm_delete_folder` | Delete a folder |
| `gtm_move_tag_to_folder` | Move a tag to/from a folder |
| `gtm_move_trigger_to_folder` | Move a trigger to/from a folder |
| `gtm_move_variable_to_folder` | Move a variable to/from a folder |

### Analysis
| Tool | Description |
|------|-------------|
| `gtm_get_tag_dependencies` | Show tag trigger dependencies |
| `gtm_find_unused_entities` | Find unused tags/triggers/variables |
| `gtm_find_orphaned_triggers` | Find triggers not used by any tag |
| `gtm_validate_container` | Run full Zod validation |

### Lifecycle
| Tool | Description |
|------|-------------|
| `gtm_analyze_tag_firing_order` | Deterministic firing order, sequencing deps, conflicts |
| `gtm_analyze_consent_setup` | Consent pattern detection, issue classification, recommendations |
| `gtm_get_tag_lifecycle` | Per-tag lifecycle phase, consent relationships, issues |

### Server-Side GTM
| Tool | Description |
|------|-------------|
| `gtm_list_zones` | List all zones |
| `gtm_get_zone` | Get zone details |
| `gtm_list_clients` | List all clients |
| `gtm_get_client` | Get client details |
| `gtm_list_transformations` | List all transformations |
| `gtm_get_transformation` | Get transformation details |
| `gtm_list_custom_templates` | List all custom templates |
| `gtm_get_custom_template` | Get custom template details |

### Export
| Tool | Description |
|------|-------------|
| `gtm_export_container` | Export container state to JSON |
| `gtm_diff_containers` | Compare two container files |

### Search
| Tool | Description |
|------|-------------|
| `gtm_search` | Full-text search across entity names and notes |

### Undo/Redo
| Tool | Description |
|------|-------------|
| `gtm_undo` | Undo the last mutation |
| `gtm_redo` | Redo the last undone mutation |

## Resources (4 total)

Read-only MCP resources for container state snapshots:

| Resource | URI | Description |
|----------|-----|-------------|
| `container_state` | `gtm://container/state` | Entity counts and metadata |
| `container_tags` | `gtm://container/tags` | Full tag listing |
| `container_triggers` | `gtm://container/triggers` | Full trigger listing |
| `container_variables` | `gtm://container/variables` | Full variable listing |

## Prompts (5 total)

Pre-built prompt templates for common workflows:

| Prompt | Description |
|--------|-------------|
| `inspect_container` | List all entities with resolved names |
| `audit_container` | Find unused/orphaned/disabled entities |
| `debug_tag` | Debug why a specific tag isn't firing |
| `compare_containers` | Compare two container files |
| `audit_consent` | Audit consent setup, firing order, and tag lifecycle |

## Why JSON Files?

- Zero auth (no GCP project, no service account)
- Fully offline and testable
- Diffable and version-controllable
- Import back into GTM with one click

## Configuration

| Environment Variable | Description |
|---|---|
| `GTM_CONTAINER_FILE` | Path to a GTM export JSON file. Auto-loaded on startup. |
| `GTM_READ_ONLY` | Set to any value to disable all write tools (create, update, delete, move, export). Only read and analysis tools will be available. |

## Development

```bash
npm test        # Run tests
npm run dev     # Run server
npm run build   # TypeScript check
npm run lint    # Biome lint
npm run format  # Biome format
```

## License

MIT
