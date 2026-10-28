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
                    └── WindDownStatusProvider        # One wind-down read per session, shared by every surface that yields to it
                        └── TwoFactorEnforcementProvider  # Balance-tiered two-factor prompts
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
come from [BTC Map](https://btcmap.org), the community-maintained OpenStreetMap overlay.
Everything drawn is read from there; the only thing sent back is a proposal for a place
that is missing, which BTC Map's own community then surveys — nothing in the app edits or
verifies a place that already exists. This replaced the `businessMapMarkers` GraphQL query,
so the map no longer shows Galoy-registered businesses as such and no longer routes to
`sendBitcoinDestination` from a pin.

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
| Adding a place | Level-two custodial accounts only (`useIsAuthed()`, `isAtLeastLevelTwo`, and the registry's `activeAccount?.type` not `SelfCustodial`), and only while the `btcMapPlacesEnabled` kill switch is on, since the submission goes out through our backend on a Blink session. The account type comes from `useAccountRegistry` rather than `useActiveWallet`, which would subscribe the whole map to both wallet providers and re-render it on every balance change to re-decide one button. Pin first, then the form: the pin is drawn at the centre of the map view and never moves, so the region's centre is what it points at |
| Sending a place | `btcmap/use-place-submission.ts` fires the `btcMapPlaceSubmit` mutation; `btcmap/submission.ts` shapes and validates the payload. A client-minted `submissionId` is the idempotency key: retries of one attempt reuse it, so a resent request updates the original submission rather than duplicating the place. The request carries the pin as it stood when submit was tapped, so the form's location row is locked while a send is in flight: a correction made in that window could not reach the request, and the place would land at the old spot with the map showing the new one. A failure is shown on the form itself rather than in a toast, which the form's native modal would be drawn over, and in the app's own language: a refusal and a dropped request each get a translated sentence, since the backend's own wording only comes back in English — the English wording and any unexpected failure go to Crashlytics instead, so support can still tell a rate limit from a duplicate |
| Kill switch | `btcMapPlacesEnabled` in Remote Config empties the map and takes the add-place flow with it, without a release |

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
| BTC Map | Merchant map data (ODbL-attributed), and proposals for places missing from it |

## Security Considerations

1. **Authentication**: Multi-factor support (phone, email, TOTP)
2. **Token Storage**: Secure keychain storage
3. **PIN Protection**: Optional PIN/biometric lock
4. **App Check**: Firebase device attestation
5. **Network**: HTTPS/WSS only, certificate pinning consideration
6. **Two-factor nudges by balance** (`app/custodial/providers/two-factor-enforcement.tsx`): two-factor authentication means an authenticator (TOTP); an email and a phone together do not count, since an attacker who takes an account over can change both. Custodial accounts without one are nudged as their balance crosses tiers, with the thresholds read from Remote Config (`custodialTwoFactorThresholds`, sats and whole dollars, refused as a whole set when incomplete, not rising tier by tier, or more than ten times off its shipped default), and a tier written to the record only from a balance the network confirmed this session (one network-only read per session, in `useFreshAccountRead`) and thresholds from this launch's fetch, since a reached tier never lowers: a home card at the first tier, a home bulletin at the second that comes back at every session start until it has been dismissed three times, and after that whenever a session start finds a wallet above its all-time high, coming back until it is closed, and at the third a session-start modal three times, then a blocking screen that stands in for the home. A new high in one wallet while the other fell since the last session start is a transfer between them and brings no bulletin back. The blocking screen offers an authenticator or leaving custody; while the console has the self-custodial stack off (`nonCustodialEnabled`), leaving custody is not offered anywhere and the modal stays, dismissible, in the blocking screen's place. The fresh read and the Remote Config fetch each give up after ten seconds, so nothing waits on them for the whole session. The tier reached, the dismissal counters and the all-time highs live only on the device (AsyncStorage, per account), so the wall is a strong nudge rather than an enforcement: a reinstall or a second device starts its counters over, and the backend requires a second code at login only when an authenticator is set. Compliance must not rely on it. Every prompt that asks for an authenticator opens its onboarding (`app/screens/totp-screen/`): why, an app to get, the setup key, the code, then the key's backup, which takes the place of the screens before it, and the done screen, which takes the backup's. The backup is export only, through a copy or, on Android, the system's Credential Manager (`app/utils/credential-manager.ts`, which the self-custodial wallet backup also saves through; iOS offers no save sheet, so there the option is not shown), and a copy of the key is wiped from the clipboard once its screen is gone. While a code is checked, the code screen refuses the user's own ways back for up to twenty seconds, and while the key is at stake, a code being checked or the backup open, every link, the migration's too, waits in the queue (`isSetupKeyAtStake` in `app/navigation/two-factor-remedy-routes.ts`).
7. **Emergency bundle** (`app/self-custodial/recovery-bundle/`): the file that lets a self-custodial user move their bitcoin onchain without Blink if the Spark operators go offline (unilateral exit). Every self-custodial wallet keeps one on the device, encrypted with a key derived from the seed, in the documents directory and excluded from iOS device backups; a wallet that has never held funds has none yet. `useRecoveryBundleRefresh` (mounted once in `app/app.tsx`) rebuilds it in the background 15 seconds after each payment and at startup when it is a day old or misses a payment, retrying a failed run with backoff; there is no opt-out, since a bundle that falls behind the wallet cannot recover what it misses. When the seed is backed up to iCloud or Google Drive, with or without a passphrase, every saved bundle is also uploaded silently to the same provider; it is the same seed-encrypted file, so it is only as protected as the seed backup beside it. A manual backup leaves it on the device only. Settings → Emergency exit shows for every self-custodial account and hands over a decrypted copy through the share sheet, after a sensitive-data warning. The app itself cannot restore from a bundle; the screen links to the unilateral-exit case study instead. Deleting the account sweeps the device copy and its state for both networks; the cloud copy stays, like the cloud seed backup.

## Performance Patterns

1. **Apollo Cache**: Persistent cache with AsyncStorage
2. **Query Batching**: Persisted queries with SHA-256 hashes
3. **Lazy Loading**: Screen-based code splitting
4. **Image Optimization**: SVG icons, optimized assets
5. **Retry Logic**: Automatic retry with backoff
