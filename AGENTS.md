# Blink Mobile - AI Agent Guidelines

## Documentation

Based on the PR's changed files, read relevant docs thoroughly:

| Document | When to Read |
|----------|--------------|
| /docs/architecture.md | Changes to providers, navigation, state management, auth flow |
| /docs/api-reference.md | GraphQL queries/mutations, Apollo client changes |
| /docs/source-tree-analysis.md | New files, directory structure questions |
| /docs/technology-stack.md | Dependency changes, build config, new packages |

**Then read /docs/index.md** - it's the master index linking to additional docs (dev setup, E2E testing, i18n guide, etc.). Follow relevant references if they apply to the PR.

## Critical Rules (Always Apply)
- `app/graphql/generated.ts` is AUTO-GENERATED - never modify manually
- Payment mutations must NOT have retry logic (handled specially in client.tsx)
- Sensitive data → react-native-keychain, not AsyncStorage
- All user-facing strings via typesafe-i18n
