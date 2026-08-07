# Blink Mobile - AI Agent Guidelines

Guidelines for AI coding agents working on this React Native + TypeScript codebase.

## Documentation

Based on the PR's changed files, read relevant docs thoroughly:

| Document | When to Read |
|----------|--------------|
| /docs/architecture.md | Providers, navigation, state management, auth flow, GraphQL/Apollo, directory layout |
| /docs/technology-stack.md | Dependency changes, build config, new packages |
| /docs/pr-review.md | Reviewing a PR, or authoring one (conventions, checklists, review standards) |

**Then read /docs/index.md** - it's the master index linking to additional docs (dev setup, E2E testing, i18n guide, etc.). Follow relevant references if they apply to the PR.

## Boundaries (Human Authority)

- Never approve or merge PRs - every change requires human review and approval
- Do not modify CI workflows, build configuration, or release/signing setup unless explicitly asked to
- Never read, write, or commit secrets or credentials
- When uncertain about scope, architecture, or product intent, ask a human instead of deciding

## Critical Rules (Always Apply)

- `app/graphql/generated.ts` is AUTO-GENERATED - never modify manually
- Payment mutations must NOT have retry logic (handled specially in client.tsx)
- Sensitive data → react-native-keychain, not AsyncStorage
- All user-facing strings via typesafe-i18n

## Keep Docs in Sync

If your change alters something the docs describe (providers, navigation, dependencies, endpoints, directory layout), update the affected doc in the same PR. The docs deliberately contain no version numbers or counts, so only structural changes require doc updates.
