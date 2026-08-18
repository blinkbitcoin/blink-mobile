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
├── sendBitcoin*        # Send flow (5 screens)
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
| Merchant Map | BTC Map places, held offline | `app/btcmap` + chunked AsyncStorage |

### Merchant map data (`app/btcmap`)

The map screen is the one feature that does not read from the Galoy backend. Its merchants
come from [BTC Map](https://btcmap.org), the community-maintained OpenStreetMap overlay,
and the app is a read-only consumer — nothing here writes back. This replaced the
`businessMapMarkers` GraphQL query, so the map no longer shows Galoy-registered businesses
as such and no longer routes to `sendBitcoinDestination` from a pin.

| Concern | Approach |
|---------|----------|
| Cold start | One gzipped ~550 KB CDN snapshot (`cdn.static.btcmap.org`), not a paged API walk |
| Staying current | `updated_since` delta against `api.btcmap.org/v4`, at most hourly, on focus and app resume |
| Offline cache | ~2.4 MB of places chunked at 5k rows across AsyncStorage, meta row written last so a torn write reads as "no cache" |
| Per-place detail | Fetched on tap; the snapshot holds only id, coordinates, icon and boost |
| Labels | Fetched per settled viewport, on a ~1.1 km grid so the centre is not a location trail |
| Search | One `places/search` call per opened search, on the same grid and radius-capped; typing then filters that list on-device, since the endpoint takes no text query |
| Category filter | Buckets BTC Map's icon names (`btcmap/categories.ts`) — the only classification the offline snapshot carries, so filtering needs no network |
| Clustering | supercluster, indexed over a box 3× the viewport rather than the whole feed. A filter change re-indexes hundreds of points instead of ~29k, which is the difference between a 1.2 s freeze and an unnoticed one |
| Marker removal | Needs `patches/react-native-maps+1.27.2.patch`: `safeAddFeature` overwrote instead of inserting, so filtered-out pins stayed on the map forever. Pinned by `__tests__/patches/maps-marker-removal-patch.spec.ts` |
| Untrusted input | Every OSM-sourced link is scheme-checked in `btcmap/urls.ts` before it reaches `Linking.openURL` |
| Kill switch | `btcMapPlacesEnabled` in Remote Config empties the map without a release |

Because the snapshot shares Android's AsyncStorage database with the persisted Apollo
cache, `AsyncStorage_db_size_in_MB` is raised from the 6 MB default in
`android/gradle.properties`.

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
| BTC Map | Merchant map data (read-only, ODbL-attributed) |

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
