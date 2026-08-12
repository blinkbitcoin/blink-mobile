---
applyTo: "**/*"
excludeAgent: "coding-agent"
---
# Documentation Freshness Review

The docs under `docs/` are hand-curated and deliberately contain no version numbers or
counts, so most PRs need no doc updates. Only flag a PR when it matches one of the
triggers below. See [docs/index.md](../../docs/index.md) for the complete catalog.

## Triggers

| PR touches | Required doc update |
|------------|---------------------|
| Provider stack in `app/app.tsx` | [architecture.md](../../docs/architecture.md) provider tree |
| `app/navigation/root-navigator.tsx` or `app/navigation/stack-param-lists.ts` (screens/navigators added or removed) | [architecture.md](../../docs/architecture.md) navigation section |
| `package.json` dependencies added or removed (not version bumps) | [technology-stack.md](../../docs/technology-stack.md) |
| `app/graphql/client.tsx` link chain, retry behavior, or endpoints | [architecture.md](../../docs/architecture.md) Apollo config / endpoints |
| New top-level directory under `app/` | [architecture.md](../../docs/architecture.md) "Where Things Live" |
| New file in `docs/` | [index.md](../../docs/index.md) catalog |

## Guidance

- Version-only dependency bumps require NO doc updates (the docs contain no versions by design)
- Don't block PRs for minor doc gaps, but comment suggesting updates
- For significant structural changes, request doc updates before merge
- Reference the specific doc section that needs attention
