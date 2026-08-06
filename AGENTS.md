# Blink Mobile - AI Agent Guidelines

## Documentation

Based on the PR's changed files, read relevant docs thoroughly:

| Document | When to Read |
|----------|--------------|
| /docs/architecture.md | Changes to providers, navigation, state management, auth flow |
| /docs/api-reference.md | GraphQL queries/mutations, Apollo client changes |
| /docs/source-tree-analysis.md | New files, directory structure questions |
| /docs/technology-stack.md | Dependency changes, build config, new packages |
| /docs/pr-review.md | Reviewing a PR, or authoring one (conventions, checklists, review standards) |

**Then read /docs/index.md** - it's the master index linking to additional docs (dev setup, E2E testing, i18n guide, etc.). Follow relevant references if they apply to the PR.

## Skills

Executable agent workflows live in `.claude/skills/` — isolated iOS simulator
sessions (`react-native-ios-simulator`), PR demo capture
(`react-native-demo-screenshots`, `react-native-demo-videos`), and embedding
images in PR comments (`github-pr-image-attachments`). Use them instead of
improvising `simctl`/Metro/capture commands. After editing any skill's
scripts, run its `tests/run.sh` (or `.claude/skills/run-all-tests.sh` for all).

The skills are app-agnostic; this repo's values for their required
configuration are:

```bash
export DEMO_APP_ID_IOS=io.galoy.bitcoinbeach
export DEMO_APP_ID_ANDROID=com.galoyapp
```

Set them before claiming a simulator session or recording a flow — the
scripts refuse to guess an app id.

## Critical Rules (Always Apply)
- `app/graphql/generated.ts` is AUTO-GENERATED - never modify manually
- Payment mutations must NOT have retry logic (handled specially in client.tsx)
- Sensitive data → react-native-keychain, not AsyncStorage
- All user-facing strings via typesafe-i18n
