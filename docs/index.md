# Blink Mobile Documentation

## Project Overview

| Property | Value |
|----------|-------|
| **Name** | blink-mobile (GaloyApp) |
| **Type** | React Native Mobile Application |
| **Platforms** | iOS, Android |
| **Language** | TypeScript |
| **Framework** | React Native 0.76.9 |
| **Repository** | blink-mobile |
| **Documentation Generated** | 2025-12-12 |

## Quick Start

```bash
# Prerequisites: Nix with flakes, Direnv

# 1. Clone and enter directory
git clone git@github.com:GaloyMoney/blink-mobile.git
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
| [Architecture](./architecture.md) | System architecture, component hierarchy, data flow |
| [Technology Stack](./technology-stack.md) | Complete list of technologies and dependencies |
| [Source Tree Analysis](./source-tree-analysis.md) | Directory structure and code organization |
| [API Reference](./api-reference.md) | GraphQL API types, queries, and mutations |
| [CSV Export field explanations](./csv.md) | Transaction History, Payments, Types and FAQ on the matter |

### Existing Documentation

| Document | Description |
|----------|-------------|
| [Development Setup](./dev.md) | Development environment setup guide |
| [E2E Testing](./e2e-testing.md) | End-to-end testing with Detox/Appium |
| [README](../README.md) | Project overview and basic instructions |
| [Contributing](../CONTRIBUTING.MD) | Contribution guidelines |

### Quick Reference

| Topic | Location |
|-------|----------|
| i18n Guide | [app/i18n/README.md](../app/i18n/README.md) |
| Android Fastlane | [android/fastlane/README.md](../android/fastlane/README.md) |

## Project Statistics

| Metric | Count |
|--------|-------|
| Components | 55 directories |
| Screens | 30 directories |
| GraphQL Queries | 192 hooks |
| GraphQL Mutations | 50 hooks |
| Supported Languages | 28 |
| Unit Test Files | 48 |
| Icon Assets | 44 SVG files |

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
│  Data: GraphQL (192 queries, 50 mutations)     │
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
| `check-code.yml` | PR | Lint, type check |
| `test.yml` | PR | Unit tests |
| `e2e.yml` | PR | E2E tests (iOS + Android) |
| `audit.yml` | Schedule | Security audit |
| `codeql.yml` | PR | Code analysis |

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
- **Multi-Language**: 28 supported languages
- **Push Notifications**: Transaction alerts

## External Resources

- [Blink Website](https://blink.sv)
- [Blink API Docs](https://dev.blink.sv)
- [Galoy GitHub](https://github.com/GaloyMoney)
- [Community Chat](https://chat.blink.sv)
