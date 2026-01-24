# Architecture Documentation

## Project: blink-mobile (GaloyApp)

**Generated:** 2025-12-12
**Type:** React Native Mobile Application

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
│  │  │  (192 hooks)      │  │  (50 hooks)        │             ││
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

```
GestureHandlerRootView
└── PersistentStateProvider          # Local persistent state
    └── TypesafeI18n                  # Internationalization
        └── GaloyClient               # Apollo GraphQL client
            └── GaloyThemeProvider    # UI theming
                └── FeatureFlagContextProvider
                    └── ActionsProvider
                        └── NavigationContainerWrapper
                            └── ErrorBoundary
                                └── RootSiblingParent
                                    └── NotificationsProvider
                                        ├── AppStateWrapper
                                        ├── PushNotificationComponent
                                        ├── RootStack (Navigation)
                                        ├── NetworkErrorComponent
                                        └── ActionModals
```

### Navigation Structure

```
RootStack (Stack Navigator)
├── getStarted          # Initial screen (unauthenticated)
├── authenticationCheck # Auth check screen
├── authentication      # Login/PIN screen
├── login               # Login method selection
├── pin                 # PIN entry
├── Primary             # Main app (Tab Navigator)
│   ├── Home            # Dashboard with balances
│   ├── People          # Contacts (Stack Navigator)
│   │   ├── peopleHome
│   │   ├── contactDetail
│   │   ├── allContacts
│   │   └── circlesDashboard
│   ├── Map             # Merchant map
│   └── Earn            # Educational content
├── scanningQRCode      # QR scanner
├── sendBitcoin*        # Send flow (4 screens)
├── receiveBitcoin      # Receive flow
├── conversion*         # Currency conversion (3 screens)
├── settings            # Settings screen
├── transaction*        # Transaction screens
├── phone*/email*/totp* # Auth method screens
├── onboarding          # Onboarding flow (Stack Navigator)
│   ├── welcomeLevel1
│   ├── emailBenefits
│   ├── lightningBenefits
│   └── supportScreen
└── [other screens]
```

## Data Flow

### GraphQL Operations

**Queries (192 hooks)** - Data fetching:
- `useWalletOverviewScreenQuery` - Main dashboard data
- `useRealtimePriceQuery` - Bitcoin price updates
- `useTransactionsQuery` - Transaction history
- `useContactsQuery` - Contact list
- `useAnalyticsQuery` - Analytics data

**Mutations (50 hooks)** - Data modifications:
- `useIntraLedgerPaymentSendMutation` - Internal transfers
- `useLnInvoicePaymentSendMutation` - Lightning payments
- `useOnChainPaymentSendMutation` - On-chain transactions
- `useUserUpdateUsernameMutation` - Profile updates
- `useDeviceNotificationTokenCreateMutation` - Push notifications

**Subscriptions (1 hook)** - Real-time updates:
- Price updates via WebSocket

### State Management Layers

| Layer | Purpose | Technology |
|-------|---------|------------|
| Server State | API data, transactions, wallets | Apollo Client Cache |
| Auth State | Login status, tokens | IsAuthedContext |
| Persistent State | Settings, preferences | PersistentStateContext + AsyncStorage |
| UI State | Loading, errors, modals | React Context + local state |
| Feature Flags | Feature toggles | FeatureFlagContext |

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

### Phone Authentication CAPTCHA Behavior

| Environment | CAPTCHA Handling |
|-------------|------------------|
| Production | Geetest challenge shown, server validates |
| Local/Staging | Dummy values sent ("bypass"), server-side `test_accounts_captcha` handles bypass |

In test environments (Local/Staging), the app calls the API with dummy CAPTCHA values instead of showing the Geetest challenge. The server-side `test_accounts_captcha` config determines which phone numbers can bypass CAPTCHA validation.

## Bitcoin/Lightning Architecture

### Wallet Types

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
3. **Lazy Loading**: Screen-based code splitting
4. **Image Optimization**: SVG icons, optimized assets
5. **Retry Logic**: Automatic retry with backoff
