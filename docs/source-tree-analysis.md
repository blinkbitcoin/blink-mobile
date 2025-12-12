# Source Tree Analysis

## Project: blink-mobile (GaloyApp)

**Generated:** 2025-12-12
**Scan Level:** Exhaustive

## Directory Structure

```
blink-mobile/
├── app/                          # Main application source
│   ├── app.tsx                   # Root component with provider tree
│   ├── assets/                   # Static assets
│   │   ├── fonts/                # Custom fonts
│   │   ├── icons/                # 44 SVG icons
│   │   ├── icons-redesign/       # Redesigned icons
│   │   ├── images/               # Image assets
│   │   └── logo/                 # App logo variants
│   ├── components/               # 55 reusable UI components
│   │   ├── actions/              # Action modals and providers
│   │   ├── amount-input/         # Amount input components
│   │   ├── atomic/               # Atomic design components
│   │   ├── balance-header/       # Balance display header
│   │   ├── circle/               # Circle/social components
│   │   ├── currency-keyboard/    # Custom currency input
│   │   ├── galoy-theme-provider/ # Theme provider wrapper
│   │   ├── galoy-toast/          # Toast notifications
│   │   ├── map-component/        # Map display components
│   │   ├── notifications/        # Push notification handling
│   │   └── ...                   # 45+ more component dirs
│   ├── config/                   # App configuration
│   │   ├── appinfo.ts            # App metadata
│   │   ├── feature-flags-context.tsx  # Feature flag provider
│   │   ├── galoy-instances.ts    # Backend environment configs
│   │   └── index.ts              # Config exports
│   ├── graphql/                  # GraphQL layer
│   │   ├── client.tsx            # Apollo Client setup
│   │   ├── cache.ts              # Cache configuration
│   │   ├── generated.ts          # Auto-generated types/hooks (10K+ lines)
│   │   ├── generated.gql         # Generated GraphQL operations
│   │   ├── fragments.ts          # Shared GraphQL fragments
│   │   ├── local-schema.gql      # Client-side schema extensions
│   │   ├── is-authed-context.ts  # Auth state context
│   │   ├── network-error-context.ts  # Error handling context
│   │   └── ...                   # Utility files
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-app-config.ts     # App configuration hook
│   │   ├── use-device-location.ts # Geolocation hook
│   │   ├── use-display-currency.ts # Currency display hook
│   │   ├── use-geetest-captcha.ts # Captcha integration
│   │   ├── use-logout.ts         # Logout functionality
│   │   ├── use-price-conversion.ts # Price conversion
│   │   └── ...                   # Additional hooks
│   ├── i18n/                     # Internationalization
│   │   ├── en/                   # English (base language)
│   │   ├── es/, fr/, de/, ...    # 28 language directories
│   │   ├── i18n-react.tsx        # React integration
│   │   ├── i18n-types.ts         # Type definitions
│   │   ├── mapping.ts            # Language mappings
│   │   └── raw-i18n/             # Raw translation files
│   ├── navigation/               # React Navigation setup
│   │   ├── root-navigator.tsx    # Main navigator with all routes
│   │   ├── stack-param-lists.ts  # Navigation type definitions
│   │   ├── app-state.tsx         # App state wrapper
│   │   └── navigation-container-wrapper.tsx
│   ├── rne-theme/                # React Native Elements theme
│   │   └── ...                   # Theme configuration
│   ├── screens/                  # 30 screen directories
│   │   ├── home-screen/          # Main dashboard
│   │   ├── send-bitcoin-screen/  # Send BTC/Lightning flow
│   │   ├── receive-bitcoin-screen/ # Receive BTC/Lightning
│   │   ├── authentication-screen/ # Login/auth screens
│   │   ├── settings-screen/      # App settings
│   │   ├── people-screen/        # Contacts/social
│   │   ├── map-screen/           # Merchant map
│   │   ├── earns-screen/         # Educational content
│   │   ├── transaction-history/  # Transaction list
│   │   └── ...                   # Additional screens
│   ├── store/                    # State management
│   │   └── persistent-state/     # Persistent local state
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utility functions
│       ├── locale-detector.ts    # Language detection
│       ├── storage.ts            # AsyncStorage wrapper
│       ├── testProps.ts          # E2E test helpers
│       └── ...                   # Additional utilities
├── android/                      # Android native code
│   ├── app/                      # Android app module
│   │   ├── src/main/             # Main source
│   │   └── build.gradle          # App build config
│   ├── fastlane/                 # Fastlane deployment
│   └── gradle/                   # Gradle wrapper
├── ios/                          # iOS native code
│   ├── GaloyApp/                 # iOS app target
│   ├── GaloyApp.xcodeproj/       # Xcode project
│   ├── GaloyApp.xcworkspace/     # Xcode workspace
│   ├── Pods/                     # CocoaPods dependencies
│   └── fastlane/                 # Fastlane deployment
├── __tests__/                    # Unit tests (48 files)
│   ├── components/               # Component tests
│   ├── hooks/                    # Hook tests
│   ├── screens/                  # Screen tests
│   ├── utils/                    # Utility tests
│   └── ...                       # Domain-specific tests
├── __mocks__/                    # Jest mocks
├── e2e/                          # End-to-end tests
│   ├── config/                   # WebDriverIO/Detox config
│   ├── detox/                    # Detox test specs
│   └── utils/                    # E2E utilities
├── .storybook/                   # Storybook configuration
├── .github/                      # GitHub config
│   ├── workflows/                # 8 CI/CD workflows
│   └── ISSUE_TEMPLATE/           # Issue templates
├── ci/                           # CI configuration
│   ├── config/                   # CI config files
│   └── tasks/                    # CI task definitions
├── dev/                          # Development tools
│   └── vendor/                   # Development dependencies
├── docs/                         # Documentation (this folder)
├── patches/                      # Patch-package patches
└── utils/                        # Build utilities
```

## Entry Points

| File | Purpose |
|------|---------|
| `index.js` | React Native entry point, registers `App` component |
| `app/app.tsx` | Root React component with provider tree |
| `app/navigation/root-navigator.tsx` | Main navigation structure |

## Critical Directories

### `/app/graphql/` - API Layer
The GraphQL directory contains the entire data layer:
- `client.tsx`: Apollo Client setup with WebSocket, caching, auth
- `generated.ts`: 10,469 lines of auto-generated types and hooks
- 192 queries, 50 mutations, 1 subscription

### `/app/screens/` - User Interface
30 screen directories organized by feature:
- Authentication flow (login, registration, PIN)
- Bitcoin operations (send, receive, convert)
- Social features (contacts, circles)
- Settings and configuration

### `/app/components/` - Reusable UI
55 component directories with shared UI elements:
- Input components (amount, currency, code)
- Display components (balance, transactions)
- Modal components (actions, confirmations)
- Navigation components (headers, tabs)

### `/app/i18n/` - Internationalization
28 supported languages with type-safe translations:
- English as base language
- Complete translations for major languages
- typesafe-i18n for compile-time safety

## Platform-Specific Code

### iOS (`/ios/`)
- Native module: `GaloyApp`
- Build system: CocoaPods + Xcode
- Deployment: Fastlane with Match for code signing

### Android (`/android/`)
- Native module: `com.galoyapp`
- Build system: Gradle
- Deployment: Fastlane

## Test Structure

| Directory | Type | Framework |
|-----------|------|-----------|
| `__tests__/` | Unit tests | Jest + Testing Library |
| `e2e/detox/` | E2E tests | Detox |
| `e2e/` (root) | E2E tests | WebDriverIO + Appium |
| `.storybook/` | Component tests | Storybook |
