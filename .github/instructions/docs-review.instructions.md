---
applyTo: "**/*"
excludeAgent: "coding-agent"
---
# Documentation Freshness Review

When reviewing PRs, check if code changes require documentation updates.

## Documentation Index

See [docs/index.md](../../docs/index.md) for the complete documentation catalog. Key docs:

| Document | Update When |
|----------|-------------|
| [architecture.md](../../docs/architecture.md) | Component hierarchy, data flow, navigation structure changes |
| [technology-stack.md](../../docs/technology-stack.md) | Dependencies added/removed/upgraded, new libraries |
| [source-tree-analysis.md](../../docs/source-tree-analysis.md) | New directories, major refactors, file reorganization |
| [api-reference.md](../../docs/api-reference.md) | GraphQL queries/mutations added/changed, new hooks |

## Review Checklist

Flag if PR includes:
- New dependencies without `technology-stack.md` update
- New directories/modules without `source-tree-analysis.md` update
- Architecture changes without `architecture.md` update
- New GraphQL operations without `api-reference.md` update
- Changes that invalidate existing documentation

## Guidance

- Don't block PRs for minor doc gaps, but comment suggesting updates
- For significant changes, request doc updates before merge
- Reference specific doc sections that may need attention
