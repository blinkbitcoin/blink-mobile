# Blink Mobile Documentation Index

## Project Overview

- **Name:** Blink Mobile (GaloyApp)
- **Type:** React Native Mobile Application
- **Platforms:** iOS, Android
- **Primary Language:** TypeScript
- **Framework:** React Native 0.76.9
- **Architecture:** Provider-based component hierarchy with GraphQL data layer

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Tech Stack** | React Native, TypeScript, Apollo GraphQL |
| **State Management** | Apollo Client + React Context |
| **Navigation** | React Navigation (Stack + Tabs) |
| **i18n** | TypeSafe-i18n (25+ languages) |
| **Testing** | Jest, Detox, Appium, Storybook |
| **Entry Point** | `app/app.tsx` |
| **API** | GraphQL (`api.blink.sv/graphql`) |

### Main Navigation Tabs
1. **Home** - Wallet dashboard
2. **People** - Contacts & Circles
3. **Map** - Merchant map
4. **Earn** - Educational content

## Generated Documentation

### Architecture & Structure
- [Architecture](./architecture.md) - System design, tech stack, patterns
- [Source Tree Analysis](./source-tree-analysis.md) - Directory structure, key files

### Development
- [Development Guide](./development-guide.md) - Setup, commands, workflow

### Technical Reference
- [API Contracts](./api-contracts.md) - GraphQL API documentation
- [Component Inventory](./component-inventory.md) - UI component catalog

## Existing Project Documentation

| Document | Path | Description |
|----------|------|-------------|
| README | [/README.md](/README.md) | Project overview, screenshots |
| Contributing | [/CONTRIBUTING.MD](/CONTRIBUTING.MD) | Contribution guidelines |
| AI Assistant | [/CLAUDE.md](/CLAUDE.md) | Claude Code instructions |
| Dev Setup | [/docs/dev.md](/docs/dev.md) | Development environment |
| E2E Testing | [/docs/e2e-testing.md](/docs/e2e-testing.md) | E2E test guide |
| i18n Guide | [/app/i18n/README.md](/app/i18n/README.md) | Internationalization |

## External Dependencies

### Backend Services

| Service | Location | Purpose |
|---------|----------|---------|
| Blink Backend | `../blink` | Main GraphQL API |
| Blink KYC | `../blink-kyc` | Identity verification |
| Blink Deployments | `../blink-deployments` | Deployment configs |

### API Endpoints

| Environment | URL |
|-------------|-----|
| Production | `https://api.blink.sv/graphql` |
| Staging | `https://api.staging.blink.sv/graphql` |
| Local | `http://localhost:4455/graphql` |

## Getting Started

### Development Setup

```bash
# 1. Clone and enter directory
git clone git@github.com:GaloyMoney/blink-mobile.git
cd blink-mobile

# 2. Initialize Nix environment
direnv allow

# 3. Install dependencies
yarn install

# 4. Start development
yarn start        # Metro bundler
yarn ios          # iOS
yarn android      # Android
```

### Essential Commands

```bash
yarn check-code          # Full code validation
yarn test                # Unit tests
yarn dev:codegen         # Generate GraphQL types
yarn update-translations # Update i18n
```

### Pre-Commit Checklist

1. Run `yarn check-code` - must pass
2. Run `yarn test` - ensure tests pass
3. If GraphQL changed: `yarn dev:codegen`
4. If translations changed: `yarn update-translations`

## Key Entry Points

| Purpose | File |
|---------|------|
| App Registration | `index.js` |
| Root Component | `app/app.tsx` |
| Navigation | `app/navigation/root-navigator.tsx` |
| GraphQL Client | `app/graphql/client.tsx` |
| Generated Types | `app/graphql/generated.ts` |
| Translations | `app/i18n/en/index.ts` |
| Backend Config | `app/config/galoy-instances.ts` |

## Project Statistics

| Metric | Count |
|--------|-------|
| Screen Modules | 29+ |
| Component Modules | 55+ |
| Supported Languages | 25+ |
| Custom Hooks | 9 |
| GraphQL Files | 13 |
| CI Workflows | 7 |

---

## Document Generation Info

| Field | Value |
|-------|-------|
| Generated | 2025-12-09 |
| Workflow | BMAD Document Project |
| Mode | Initial Scan |
| Scan Level | Deep |

---

*This documentation is optimized for AI-assisted development. When working on features, reference the relevant architecture sections and follow established patterns.*
