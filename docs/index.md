# Blink Mobile Documentation

> These docs are hand-curated. They deliberately contain no version numbers or counts —
> those live in the source files each doc points at. The BMAD document-project scan that
> originally generated some of them was retired (see blink-wip#1041); do **not**
> regenerate — a re-scan would recreate deleted docs and overwrite curation. When a code
> change alters something a doc describes, update the doc in the same PR.

## Project Overview

| Property | Value |
|----------|-------|
| **Name** | blink-mobile (GaloyApp) |
| **Type** | React Native Mobile Application (React Native + TypeScript) |
| **Platforms** | iOS, Android |
| **Repository** | blink-mobile |

## Quick Start

```bash
# Prerequisites: Nix with flakes, Direnv

# 1. Clone and enter directory
git clone git@github.com:blinkbitcoin/blink-mobile.git
cd blink-mobile
direnv allow

# 2. Install dependencies
yarn install

# 3. Start development
yarn start           # Metro bundler (terminal 1)
yarn android         # Android (terminal 2)
# or
yarn ios             # iOS (terminal 2)
```

## Documentation Index

### Core Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture, providers, navigation, data flow, directory layout |
| [Technology Stack](./technology-stack.md) | What each technology and dependency is for |

### Existing Documentation

| Document | Description |
|----------|-------------|
| [Development Setup](./dev.md) | Development environment setup guide |
| [PR Review Guide](./pr-review.md) | Review conventions, checklists, and enforced standards for pull requests |
| [E2E Testing](./e2e-testing.md) | End-to-end testing with Detox/Appium |
| [Android env config & R8](./android-env-config-r8.md) | Verifying `react-native-config` values survive R8 in release builds |
| [Self-Custodial Rollout](./self-custodial-rollout.md) | Self-custodial wallet rollout plan and status |
| [Dollar vs Stablesats Naming](./dollar-vs-stablesats-naming-analysis.md) | Naming analysis for the USD wallet |
| [README](../README.md) | Project overview and basic instructions |
| [Contributing](../CONTRIBUTING.MD) | Contribution guidelines |

### Quick Reference

| Topic | Location |
|-------|----------|
| i18n Guide | [app/i18n/README.md](../app/i18n/README.md) |
| Android Fastlane | [android/fastlane/README.md](../android/fastlane/README.md) |

## Key Entry Points

| File | Purpose |
|------|---------|
| `index.js` | React Native entry point |
| `app/app.tsx` | Root React component |
| `app/navigation/root-navigator.tsx` | Navigation structure |
| `app/graphql/client.tsx` | Apollo Client setup |
| `app/graphql/generated.ts` | Auto-generated GraphQL types |

## Architecture Overview

```
┌────────────────────────────────────────────────┐
│              React Native App                   │
├────────────────────────────────────────────────┤
│  UI: Screens + Components (React Navigation)   │
├────────────────────────────────────────────────┤
│  State: Apollo Client + React Context          │
├────────────────────────────────────────────────┤
│  Data: GraphQL (generated queries/mutations)   │
├────────────────────────────────────────────────┤
│  Native: iOS (Swift/ObjC) + Android (Kotlin)   │
└────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│           Blink Backend (api.blink.sv)         │
│  - Authentication (Phone/Email/TOTP)           │
│  - Wallets (BTC + USD)                         │
│  - Lightning Network                           │
│  - On-Chain Bitcoin                            │
└────────────────────────────────────────────────┘
```

## Development Workflow

### Daily Development
```bash
yarn start           # Start Metro bundler
yarn android         # or yarn ios
```

### Before Committing
```bash
yarn check-code      # Lint + type check
yarn test            # Unit tests
```

### GraphQL Schema Updates
```bash
yarn dev:codegen     # Regenerate types
```

### Adding Translations
```bash
# Edit app/i18n/en/index.ts
yarn update-translations
```

### Running E2E Tests
```bash
make tilt-up         # Start local backend
yarn e2e:build ios.sim.debug
yarn e2e:test ios.sim.debug
```

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `check-code.yml` | PR | Lint, type check, translations + codegen checks |
| `test.yml` | PR | Unit tests |
| `e2e.yml` | PR | E2E tests (iOS + Android) |
| `audit.yml` | PR | Dependency security audit |
| `codeql.yml` | PR + push to main | Code analysis |
| `conventional.yaml` | PR | Conventional-commit title check |
| `spelling.yml` | PR | Spell check (`typos`) |
| `update_pods.yml` | Dependabot branches | Refresh `Podfile.lock` for dependency bumps |

## Backend Environments

| Environment | API | Use Case |
|-------------|-----|----------|
| Production | api.blink.sv | Live app |
| Staging | api.staging.blink.sv | Testing |
| Local | localhost:4455 | Development |

## Key Features

- **Bitcoin Wallet**: Send/receive BTC via Lightning and on-chain
- **USD Wallet**: Stablesats dollar-denominated balance
- **Multi-Auth**: Phone, Email, TOTP, Telegram
- **Contacts**: Username-based payments
- **Merchant Map**: Find Bitcoin-accepting businesses
- **Educational Content**: Learn about Bitcoin (Earn section)
- **Multi-Language**: localized UI (one locale directory per language under `app/i18n/`)
- **Push Notifications**: Transaction alerts

## External Resources

- [Blink Website](https://blink.sv)
- [Blink API Docs](https://dev.blink.sv)
- [Blink GitHub](https://github.com/blinkbitcoin)
- [Community Chat](https://chat.blink.sv)
