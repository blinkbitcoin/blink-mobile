# Architecture Documentation

## Project: blink-mobile (GaloyApp)

**Type:** React Native Mobile Application

This is a hand-curated document. It intentionally avoids counts and version numbers —
those live in the source files referenced throughout. When a change alters something
described here, update this document in the same PR.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    UI Layer (React Native)                  ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       ││
│  │  │ Screens │  │Components│  │Navigation│  │ Theme  │       ││
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       ││
│  └───────┼────────────┼───────────┼────────────┼──────────────┘│
│          │            │           │            │                │
│  ┌───────┴────────────┴───────────┴────────────┴──────────────┐│
│  │                    State Management                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        ││
│  │  │Apollo Client│  │React Context│  │AsyncStorage │        ││
│  │  │  (GraphQL)  │  │  (Local)    │  │(Persistent) │        ││
│  │  └──────┬──────┘  └─────────────┘  └─────────────┘        ││
│  └─────────┼──────────────────────────────────────────────────┘│
│            │                                                    │
│  ┌─────────┴──────────────────────────────────────────────────┐│
│  │                    Data Layer                               ││
│  │  ┌───────────────────┐  ┌────────────────────┐             ││
│  │  │  GraphQL Queries  │  │  GraphQL Mutations │             ││
│  │  └─────────┬─────────┘  └──────────┬─────────┘             ││
│  └────────────┼─────────────────────────────────┬──────────────┘│
│               │                                 │ WebSocket     │
│               ▼                                 ▼               │
└───────────────┴─────────────────────────────────┴───────────────┘
                │                                 │
                ▼                                 ▼
        ┌───────────────────────────────────────────────┐
        │              Blink Backend API                 │
        │          (api.blink.sv/graphql)                │
        │                                                │
        │  - User Authentication (Phone/Email/TOTP)      │
        │  - Wallet Management (BTC/USD)                 │
        │  - Lightning Network Operations                │
        │  - On-Chain Bitcoin Operations                 │
        │  - Real-time Price Updates                     │
        └───────────────────────────────────────────────┘
```

## Component Architecture

### Provider Tree (app/app.tsx)

Source of truth: `app/app.tsx`.

```
GestureHandlerRootView
└── PersistentStateProvider              # Local persistent state
    └── TypesafeI18n                     # Internationalization
        └── GaloyClient                  # Apollo GraphQL client
            └── GaloyThemeProvider       # UI theming
                └── FeatureFlagContextProvider
                    └── CustodialWalletProvider          # Custodial wallet state
                        └── SelfCustodialWalletProvider  # Self-custodial (Spark) wallet state
                            └── BackupStateProvider      # Recovery-phrase backup state
                                └── AutoConvertStatusProvider
                                    └── ActionsProvider
                                        └── MigrationBlockerProvider  # Account-migration gating
                                            └── NavigationContainerWrapper
                                                └── ErrorBoundary
                                                    └── RootSiblingParent
                                                        ├── NotificationsProvider
                                                        │   ├── AppStateWrapper
                                                        │   ├── PushNotificationComponent
                                                        │   ├── AutoConvertListenerMount
                                                        │   ├── RootStack (Navigation)
                                                        │   ├── NetworkErrorComponent
                                                        │   └── ActionModals
                                                        └── GaloyToast
```

### Navigation Structure

Source of truth: `app/navigation/root-navigator.tsx` and
`app/navigation/stack-param-lists.ts`. Routes are listed here as product-area groups,
not exhaustively — read the navigator for the full registry.

```
RootStack (native stack navigator)
├── Auth & entry: getStarted, accountTypeSelection, unsupportedRegion,
│   authenticationCheck, authentication, login, pin, acceptTermsAndConditions
├── Primary (bottom-tab navigator)
│   ├── Home            # Dashboard with balances
│   ├── People          # Contacts (nested stack: peopleHome, contactDetail,
│   │                   #   allContacts, circlesDashboard)
│   ├── Map             # Merchant map
│   └── Earn            # Educational content
├── Payments: scanningQRCode, sendBitcoin* (destination → details → confirmation
│   → completed), merchantSelection, receiveBitcoin, setLightningAddress,
│   redeemBitcoin*, conversion* (details → confirmation → success)
├── Transactions: transactionDetail, transactionHistory, transactionLimitsScreen,
│   unclaimedDepositsScreen, priceHistory, feeRatesScreen
├── Settings & account: settings, accountScreen, profileScreen, addressScreen,
│   defaultWallet, theme, language, currency, security, notificationSettingsScreen,
│   notificationHistory, apiScreen, apiKeyCreateScreen, developerScreen
├── Auth methods: phoneFlow / phoneRegistration* (nested stack incl.
│   telegramLoginValidate), emailRegistration*, emailLogin*, totp*
├── Card: cardDashboardScreen, card* (details, limits, PIN, statements, shipping,
│   status, …), orderCardScreen, replaceCardScreen, cardOnboarding* (intro →
│   details → subscribe → payment → approval flow)
├── Self-custodial: selfCustodialWalletCreation, selfCustodialBackup* (method,
│   cloud, phrase, security checks, confirm, success), selfCustodialRestore*,
│   stableBalanceSettings
├── Account migration: accountMigration* (start, entry, explainer, keepReceiving,
│   downloadHistory, balancesOverview, transferringFunds, contactSupport)
└── Misc: earnsSection, earnsQuiz, sectionCompleted, onboarding (nested stack),
    fullOnboardingFlow, webView, selectionScreen
```

## Data Flow

### GraphQL Operations

All queries, mutations, and subscription hooks are generated into
`app/graphql/generated.ts` (auto-generated — never edit manually; regenerate with
`yarn dev:codegen`). Representative examples:

**Queries** - Data fetching:
- `useWalletOverviewScreenQuery` - Main dashboard data
- `useRealtimePriceQuery` - Bitcoin price updates
- `useTransactionListForDefaultAccountQuery` - Transaction history
- `useContactsQuery` - Contact list

**Mutations** - Data modifications:
- `useIntraLedgerPaymentSendMutation` - Internal transfers
- `useLnInvoicePaymentSendMutation` - Lightning payments
- `useOnChainPaymentSendMutation` - On-chain transactions
- `useUserUpdateUsernameMutation` - Profile updates

**Subscriptions** - Real-time updates:
- Price updates via WebSocket

### Apollo Client Configuration

Key features configured in `app/graphql/client.tsx`:

1. **Persisted Queries**: SHA-256 hashed queries for bandwidth optimization
2. **Cache Persistence**: Apollo cache stored in AsyncStorage
3. **Retry Logic**: Auto-retry with backoff (excludes payment operations)
4. **WebSocket**: Real-time subscriptions for price updates
5. **App Check**: Firebase device attestation header
6. **Auth**: Bearer token in Authorization header

### State Management Layers

| Layer | Purpose | Technology |
|-------|---------|------------|
| Server State | API data, transactions, wallets | Apollo Client Cache |
| Auth State | Login status, tokens | IsAuthedContext |
| Persistent State | Settings, preferences | PersistentStateContext + AsyncStorage |
| UI State | Loading, errors, modals | React Context + local state |
| Feature Flags | Feature toggles | FeatureFlagContext |
| Wallet State | Custodial / self-custodial wallet context | CustodialWalletProvider, SelfCustodialWalletProvider |

## Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  GetStarted  │────▶│   Login      │────▶│  Primary     │
│   Screen     │     │   Method     │     │   (Home)     │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │  Phone   │ │  Email   │ │   TOTP   │
       │  Login   │ │  Login   │ │  Login   │
       └──────────┘ └──────────┘ └──────────┘
```

**Supported Auth Methods:**
1. Phone number (SMS verification)
2. Email (code verification)
3. TOTP (authenticator app)
4. Telegram Passport

## Bitcoin/Lightning Architecture

### Account Modes: Custodial vs Self-Custodial

The app supports two account modes, plus a migration path between them:

- **Custodial** (`app/custodial/`): balances held by the Blink backend — the classic
  BTC + Stablesats USD wallets below.
- **Self-custodial** (`app/self-custodial/`): on-device Spark wallet with
  recovery-phrase backup and restore flows (see the self-custodial route group above).
- **Account migration** (`app/screens/account-migration/`): guided flow moving a
  custodial account's funds to the self-custodial wallet.

See also `docs/self-custodial-rollout.md`.

### Wallet Types (custodial)

| Wallet | Currency | Use Case |
|--------|----------|----------|
| BTC Wallet | Bitcoin (sats) | Lightning/on-chain transactions |
| USD Wallet | Stablesats (USD) | Dollar-denominated balance |

### Transaction Types

1. **Lightning Network**
   - Invoice creation/payment
   - LNURL support (pay, withdraw, auth)
   - No-amount invoices

2. **On-Chain Bitcoin**
   - Address generation
   - Fee estimation
   - Transaction broadcasting

3. **Internal (Intra-Ledger)**
   - User-to-user transfers
   - Wallet-to-wallet conversion

## Backend Integration

### API Endpoints

| Environment | GraphQL | WebSocket | Auth |
|-------------|---------|-----------|------|
| Production | api.blink.sv/graphql | wss://ws.blink.sv/graphql | api.blink.sv |
| Staging | api.staging.blink.sv/graphql | wss://ws.staging.blink.sv/graphql | api.staging.blink.sv |
| Local | localhost:4455/graphql | localhost:4455/graphqlws | localhost:4455 |

> **Note:** Local dev uses `/graphqlws` path while prod/staging use `/graphql`. See `galoy-instances.ts`.

### External Services

| Service | Purpose |
|---------|---------|
| Firebase Analytics | Usage analytics |
| Firebase Crashlytics | Crash reporting |
| Firebase Messaging | Push notifications |
| Firebase Remote Config | Feature flags |
| Firebase App Check | Device attestation |
| GeeTest | Captcha verification |

## Security Considerations

1. **Authentication**: Multi-factor support (phone, email, TOTP)
2. **Token Storage**: Secure keychain storage
3. **PIN Protection**: Optional PIN/biometric lock
4. **App Check**: Firebase device attestation
5. **Network**: HTTPS/WSS only, certificate pinning consideration

## Performance Patterns

1. **Apollo Cache**: Persistent cache with AsyncStorage
2. **Query Batching**: Persisted queries with SHA-256 hashes
3. **Lazy Loading**: Single-locale i18n loading at startup (`app/i18n/lazy-locale-loader.ts`)
4. **Image Optimization**: SVG icons, optimized assets
5. **Retry Logic**: Automatic retry with backoff (never for payment mutations)

## Where Things Live

Source of truth: the directory tree itself (`git ls-tree HEAD app/`).

| Path | Purpose |
|------|---------|
| `app/screens/` | One directory per screen |
| `app/components/` | Reusable UI components |
| `app/navigation/` | Navigators, param lists, navigation container |
| `app/graphql/` | Apollo client, generated types/hooks, cache config |
| `app/custodial/` | Custodial account logic |
| `app/self-custodial/` | Self-custodial (Spark) wallet, backup/restore |
| `app/screens/account-migration/` | Custodial → self-custodial migration flow |
| `app/hooks/` | Shared React hooks |
| `app/utils/` | Pure utilities |
| `app/store/` | Persistent state |
| `app/config/` | Environment/instance configuration |
| `app/i18n/` | Translations (typesafe-i18n; edit `en/index.ts` only) |
| `app/assets/`, `app/rne-theme/`, `app/types/` | Assets, theme, shared types |
| `ios/`, `android/` | Native projects |
| `__tests__/` | Jest unit/component tests |
| `e2e/` | End-to-end tests |
| `docs/` | Documentation (see `docs/index.md`) |
