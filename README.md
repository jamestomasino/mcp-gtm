# mcp-gtm

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

## Tools (31 total)

| Tool | Description |
|------|-------------|
| `gtm_load_container` | Load a GTM container JSON file |
| `gtm_get_container_info` | Get container metadata |
| `gtm_get_container_state` | Get summary counts |
| `gtm_list_tags` | List all tags |
| `gtm_get_tag` | Get tag by ID or name |
| `gtm_create_tag` | Create a new tag |
| `gtm_update_tag` | Update an existing tag |
| `gtm_delete_tag` | Delete a tag |
| `gtm_find_tags_by_type` | Find tags by type (e.g. gaawe) |
| `gtm_list_triggers` | List all triggers |
| `gtm_get_trigger` | Get trigger by ID or name |
| `gtm_create_trigger` | Create a new trigger |
| `gtm_update_trigger` | Update a trigger |
| `gtm_delete_trigger` | Delete a trigger |
| `gtm_list_variables` | List user-defined variables |
| `gtm_get_variable` | Get variable details |
| `gtm_create_variable` | Create a variable |
| `gtm_update_variable` | Update a variable |
| `gtm_delete_variable` | Delete a variable |
| `gtm_list_builtin_variables` | List built-in variables |
| `gtm_list_folders` | List folders |
| `gtm_get_folder` | Get folder details |
| `gtm_create_folder` | Create a new folder |
| `gtm_delete_folder` | Delete a folder |
| `gtm_move_tag_to_folder` | Move a tag to/from a folder |
| `gtm_get_tag_dependencies` | Show tag trigger dependencies |
| `gtm_find_unused_entities` | Find unused tags/triggers/variables |
| `gtm_find_orphaned_triggers` | Find triggers not used by any tag |
| `gtm_validate_container` | Run full Zod validation |
| `gtm_export_container` | Export container state to JSON |
| `gtm_diff_containers` | Compare two container files |

## Resources (4 total)

Read-only MCP resources for container state snapshots:

| Resource | URI | Description |
|----------|-----|-------------|
| `container_state` | `gtm://container/state` | Entity counts and metadata |
| `container_tags` | `gtm://container/tags` | Full tag listing |
| `container_triggers` | `gtm://container/triggers` | Full trigger listing |
| `container_variables` | `gtm://container/variables` | Full variable listing |

## Prompts (4 total)

Pre-built prompt templates for common workflows:

| Prompt | Description |
|--------|-------------|
| `inspect_container` | List all entities with resolved names |
| `audit_container` | Find unused/orphaned/disabled entities |
| `debug_tag` | Debug why a specific tag isn't firing |
| `compare_containers` | Compare two container files |

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
```

## License

MIT
