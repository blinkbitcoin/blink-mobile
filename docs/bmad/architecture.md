# Blink Mobile Architecture

## Executive Summary

Blink Mobile is a React Native Bitcoin wallet application that enables users to send, receive, and manage Bitcoin and USD through the Lightning Network. Built on a GraphQL-first architecture with Apollo Client, the app provides a seamless cross-platform experience on iOS and Android.

**Key Characteristics:**
- **Type:** React Native Mobile Application (iOS + Android)
- **Architecture Pattern:** Provider-based component hierarchy with GraphQL data layer
- **Primary Language:** TypeScript 5.4.5
- **Framework:** React Native 0.76.9

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | React Native | 0.76.9 | Cross-platform mobile development |
| **Language** | TypeScript | 5.4.5 | Type-safe JavaScript |
| **Runtime** | Node.js | >=20 | Development environment |
| **State (Remote)** | Apollo Client | 3.9.11 | GraphQL client with cache persistence |
| **State (Local)** | React Context + AsyncStorage | 2.2.0 | Persistent app state |
| **Navigation** | React Navigation | 6.x | Stack + Bottom Tab navigation |
| **API Protocol** | GraphQL | - | With WebSocket subscriptions |
| **API Codegen** | GraphQL Code Generator | 5.x | Auto-generated typed hooks |
| **i18n** | TypeSafe-i18n | 5.26.2 | Type-safe internationalization (25+ languages) |
| **UI Library** | @rn-vui/themed | 5.1.10 | Themed component library |
| **Animation** | Reanimated | 3.16.7 | Native-driven animations |
| **Firebase** | Firebase SDK | 23.3.x | Analytics, Crashlytics, Messaging, App Check |
| **Unit Testing** | Jest | 29.x | Test runner |
| **E2E Testing** | Detox + Appium | 20.x / 2.x | Native E2E testing |
| **Component Dev** | Storybook | 6.5.x | Visual component development |
| **Build Tool** | Metro | 0.81.0 | React Native bundler |

## Architecture Pattern

### Provider Hierarchy

The application uses a nested provider pattern for dependency injection and state management:

```
GestureHandlerRootView
└── PersistentStateProvider        # Local persistent state
    └── TypesafeI18n               # Internationalization
        └── GaloyClient            # Apollo GraphQL client
            └── GaloyThemeProvider # Theming
                └── FeatureFlagContextProvider
                    └── ActionsProvider
                        └── NavigationContainerWrapper
                            └── ErrorBoundary
                                └── NotificationsProvider
                                    └── RootStack  # Navigation
```

### Key Architectural Decisions

1. **GraphQL-First Data Architecture**
   - All backend communication via GraphQL (queries, mutations, subscriptions)
   - WebSocket support for real-time price updates
   - Persisted queries for bandwidth optimization
   - Apollo cache with AsyncStorage persistence

2. **Context-Based State Management**
   - `PersistentStateProvider` for app preferences and session data
   - `IsAuthedContextProvider` for authentication state
   - `NetworkErrorContextProvider` for global error handling
   - No Redux/MobX - relies on Apollo cache + React Context

3. **Feature-Based Screen Organization**
   - 29+ screen modules organized by feature
   - Each screen directory contains related components
   - Shared components in `app/components/`

4. **Type-Safe Everything**
   - GraphQL types auto-generated via codegen
   - i18n types auto-generated via TypeSafe-i18n
   - Strict TypeScript configuration

## Data Architecture

### GraphQL Integration

**Backend Endpoints:**
- **Production:** `https://api.blink.sv/graphql`
- **Staging:** `https://api.staging.blink.sv/graphql`
- **Local:** `http://localhost:4455/graphql`

**Apollo Client Configuration:**
- Persisted queries (SHA256 hashing)
- Retry logic with configurable max attempts
- App Check integration for Firebase security
- WebSocket link for subscriptions
- Error link for global error handling

**Key GraphQL Types:**
- `Account` - User account with wallets
- `BtcWallet` / `UsdWallet` - Bitcoin and USD wallets
- `Transaction` - Transaction history
- `RealtimePrice` - Live price data

### State Management Layers

| Layer | Technology | Scope |
|-------|------------|-------|
| **Server State** | Apollo Client | Remote data, transactions, account info |
| **Local Persistent** | AsyncStorage + Context | App config, auth tokens, preferences |
| **UI State** | React useState/useReducer | Component-level state |

## Navigation Architecture

### Navigation Structure

```
RootStack (Stack Navigator)
├── getStarted          # Onboarding
├── authenticationCheck # Auth verification
├── authentication      # Login flow
├── login              # Login methods
├── pin                # PIN entry
├── Primary (Tab Navigator)
│   ├── Home           # Main dashboard
│   ├── People         # Contacts & Circles
│   ├── Map            # Merchant map
│   └── Earn           # Educational content
├── sendBitcoin*       # Send flow screens
├── receiveBitcoin     # Receive screen
├── settings           # Settings screens
├── phoneFlow          # Phone auth flow
├── onboarding         # Onboarding flow
└── ... (60+ screens)
```

### Authentication Flow

1. App starts → `authenticationCheck`
2. If not authed → `getStarted` → `login`
3. If authed → `Primary` (main app)
4. PIN/biometric verification on app resume

## Security Architecture

### Authentication Methods
- Phone number (SMS verification)
- Email (code verification)
- TOTP (authenticator apps)
- Telegram integration
- Biometric (fingerprint/face)

### Security Features
- **App Check:** Firebase App Check for API protection
- **Secure Storage:** react-native-keychain for sensitive data
- **Token Management:** Bearer tokens with retry on 401
- **PIN Protection:** Local PIN lock on app

### External Services
| Service | Purpose |
|---------|---------|
| blink-backend (`../blink`) | Main GraphQL API |
| blink-kyc (`../blink-kyc`) | KYC verification |
| blink-deployments (`../blink-deployments`) | Deployment configuration |

## Component Architecture

### Atomic Design Structure

```
app/components/
├── atomic/                    # Base UI elements
│   ├── galoy-button-field/
│   ├── galoy-currency-bubble/
│   ├── galoy-error-box/
│   ├── galoy-icon/
│   ├── galoy-icon-button/
│   ├── galoy-info/
│   ├── galoy-input/
│   ├── galoy-primary-button/
│   ├── galoy-secondary-button/
│   ├── galoy-slider-button/
│   └── galoy-tertiary-button/
├── amount-input/              # Amount entry
├── balance-header/            # Balance display
├── currency-keyboard/         # Custom keyboard
├── map-component/             # Map integration
├── notifications/             # Push notifications
├── wallet-overview/           # Wallet display
└── ... (55+ component modules)
```

### Component Patterns
- Storybook stories for visual testing (`.stories.tsx`)
- Themed styling via `@rn-vui/themed`
- SVG icons with react-native-svg-transformer
- Test props helper for E2E testing (`testProps`)

## Internationalization

### Supported Languages (25+)
af, ar, ca, cs, da, de, el, en, es, fr, hr, hu, hy, id, it, ko, nl, pl, pt, ro, ru, sv, sw, th, tr, uk, vi, zh

### i18n Architecture
- **Source:** `app/i18n/en/index.ts` (English as base)
- **Types:** Auto-generated `i18n-types.ts`
- **Hook:** `useI18nContext()` for translations
- **Sync:** Server language preference synced on login

## Testing Strategy

### Test Pyramid

| Level | Tool | Location |
|-------|------|----------|
| **Unit** | Jest + Testing Library | `__tests__/**/*.spec.ts(x)` |
| **Component** | Storybook | `**/*.stories.tsx` |
| **E2E** | Detox | `e2e/` |
| **E2E (Legacy)** | Appium | `e2e/config/` |

### Test Commands
```bash
yarn test                      # Unit tests
yarn e2e:build ios.sim.debug   # Build iOS for E2E
yarn e2e:test ios.sim.debug    # Run iOS E2E
yarn e2e:build android.emu.debug
yarn e2e:test android.emu.debug
```

## CI/CD Pipeline

### GitHub Actions Workflows
- `check-code.yml` - TypeScript, ESLint, translations, GraphQL validation
- `test.yml` - Unit tests
- `e2e.yml` - E2E tests
- `audit.yml` - Security audit
- `codeql.yml` - Code analysis
- `spelling.yml` - Spell check
- `update_pods.yml` - iOS dependency updates

### Quality Gates
```bash
yarn check-code  # Must pass before merge
# Includes: tsc:check, eslint:check, check:translations, check:codegen, graphql-check
```

## Platform-Specific Configuration

### iOS
- **Project:** `ios/GaloyApp.xcworkspace`
- **Dependencies:** CocoaPods (`ios/Podfile`)
- **Firebase:** `ios/GoogleService-Info.plist`
- **Min iOS:** Configured in Xcode project

### Android
- **Project:** `android/`
- **Dependencies:** Gradle (`android/build.gradle`)
- **Firebase:** `android/app/google-services.json`
- **Min SDK:** Configured in `android/app/build.gradle`

## Development Environment

### Prerequisites
- Nix with flakes support
- direnv
- Xcode (iOS)
- Android Studio (Android)

### Setup
```bash
direnv allow           # Set up Nix environment
yarn install           # Install dependencies
yarn start             # Start Metro bundler
yarn ios               # Run on iOS
yarn android           # Run on Android
```

## Key Entry Points

| File | Purpose |
|------|---------|
| `index.js` | App registration |
| `app/app.tsx` | Root component with providers |
| `app/navigation/root-navigator.tsx` | Navigation structure |
| `app/graphql/client.tsx` | Apollo Client setup |
| `app/store/persistent-state/index.tsx` | Local state management |
| `app/i18n/en/index.ts` | Translation keys |

## External Dependencies

### Backend Services
| Service | Repository | Purpose |
|---------|------------|---------|
| Blink Backend | `../blink` | Main GraphQL API |
| Blink KYC | `../blink-kyc` | Identity verification |

### Deployment
- Repository: `../blink-deployments`
- Platforms: iOS App Store, Google Play Store
- Fastlane for automated releases

---

*Generated by BMAD Document Project Workflow*
*Scan Level: Deep | Mode: Initial Scan*
