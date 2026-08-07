# Technology Stack

## Project: blink-mobile (GaloyApp)

Versions live in `package.json`, `ios/Podfile.lock`, `android/build.gradle`, and
`flake.nix` — this document explains what each technology is for, not which version is
pinned. When adding or removing a dependency, update the relevant table here in the
same PR.

## Core Technologies

| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | React Native | Cross-platform mobile development |
| Language | TypeScript | Type-safe JavaScript |
| Runtime | Node.js | Build tooling and development (engine range in `package.json`) |
| Package Manager | Yarn | Dependency management |

## Frontend Stack

### UI Framework
| Package | Purpose |
|---------|---------|
| @rn-vui/themed | Component library (RN Elements fork) |
| react-native-reanimated | Performant animations |
| react-native-gesture-handler | Touch gestures |
| react-native-svg | Vector graphics |
| react-native-safe-area-context | Safe area handling |
| victory-native | Charts and data visualization |

### Navigation
| Package | Purpose |
|---------|---------|
| @react-navigation/native | Navigation framework |
| @react-navigation/stack | Stack-based navigation |
| @react-navigation/bottom-tabs | Tab bar navigation |

### State Management
| Package | Purpose |
|---------|---------|
| @apollo/client | GraphQL client with caching |
| apollo3-cache-persist | Cache persistence |
| @react-native-async-storage/async-storage | Key-value storage |
| React Context | Local state management |

## Data Layer

### GraphQL
| Package | Purpose |
|---------|---------|
| @apollo/client | GraphQL client |
| graphql | GraphQL language |
| graphql-ws | WebSocket subscriptions |

### Code Generation
| Package | Purpose |
|---------|---------|
| @graphql-codegen/cli | Type generation |
| @graphql-codegen/typescript | TypeScript types |
| @graphql-codegen/typescript-operations | Operation types |
| @graphql-codegen/typescript-react-apollo | React hooks |

## Bitcoin/Lightning

| Package | Purpose |
|---------|---------|
| @blinkbitcoin/blink-client | Blink payment destination parser and API client |
| @breeztech/breez-sdk-spark-react-native | Self-custodial Spark wallet SDK |
| bitcoinjs-lib | Bitcoin primitives |
| bolt11 | Lightning invoice parsing |
| js-lnurl | LNURL protocol |
| lnurl-pay | LNURL payment requests |
| @noble/hashes | Cryptographic hash utilities used by payment parsing |
| @scure/base | Base encoding utilities used by payment parsing |
| bip39 | Mnemonic phrases |

## Native Capabilities

### Camera & QR
| Package | Purpose |
|---------|---------|
| react-native-camera-kit | Camera access |
| react-native-qrcode-svg | QR code generation |

### Hardware
| Package | Purpose |
|---------|---------|
| react-native-nfc-manager | NFC support |
| react-native-fingerprint-scanner | Biometric auth |
| react-native-device-info | Device information |

### Storage & Security
| Package | Purpose |
|---------|---------|
| react-native-keychain | Secure credential storage |
| @react-native-async-storage/async-storage | Persistent storage |
| @react-native-clipboard/clipboard | Clipboard access |

### Location & Maps
| Package | Purpose |
|---------|---------|
| react-native-maps | Map display |
| react-native-permissions | Permission management |

### UI Effects
| Package | Purpose |
|---------|---------|
| @react-native-community/blur | Native blur effects for iOS and Android |

## Firebase Services

| Package | Purpose |
|---------|---------|
| @react-native-firebase/app | Firebase core |
| @react-native-firebase/analytics | Usage analytics |
| @react-native-firebase/crashlytics | Crash reporting |
| @react-native-firebase/messaging | Push notifications |
| @react-native-firebase/remote-config | Feature flags |
| @react-native-firebase/app-check | Device attestation |

## Internationalization

| Package | Purpose |
|---------|---------|
| typesafe-i18n | Type-safe translations |
| @formatjs/intl-relativetimeformat | Date formatting |
| intl-pluralrules | Pluralization rules |

**Supported languages:** one directory per locale under `app/i18n/` (source of truth).
Only `app/i18n/en/index.ts` is edited by hand; other locales are managed by the
translation pipeline (see `app/i18n/README.md`).

## Testing

| Package | Purpose |
|---------|---------|
| jest | Test runner |
| @testing-library/react-native | Component testing |
| detox | E2E testing |
| @wdio/cli | WebDriverIO |
| appium | Mobile automation |

## Build & Development

### Development Environment
| Tool | Purpose |
|------|---------|
| Nix Flake | Reproducible dev environment (toolchain versions pinned in `flake.nix`) |
| Direnv | Environment management |
| Metro | JavaScript bundler |

### CI/CD
| Tool | Purpose |
|------|---------|
| GitHub Actions | CI/CD workflows (see `docs/index.md` for the workflow list) |
| Fastlane | iOS/Android deployment |
| Tilt | Local development orchestration |

### Build Tools
| Tool | Purpose |
|------|---------|
| Xcode | iOS builds (version pinned in `flake.nix`) |
| Android SDK | Android builds (versions in `android/build.gradle` / `flake.nix`) |
| JDK | Android compilation (pinned in `flake.nix`) |
| CocoaPods | iOS dependency management |
| Gradle | Android build system |

## Development Scripts

```bash
# Start development
yarn start          # Metro bundler
yarn android        # Run on Android
yarn ios            # Run on iOS

# Testing
yarn test           # Unit tests
yarn e2e:build      # Build for E2E
yarn e2e:test       # Run E2E tests

# Code quality
yarn check-code     # Type check + lint + translations + codegen checks
yarn eslint:check   # ESLint
yarn tsc:check      # TypeScript check

# Code generation
yarn dev:codegen    # Generate GraphQL types
yarn update-translations  # Update i18n
```

## Environment Configuration

### Development Environments
| Environment | GraphQL Endpoint | Purpose |
|-------------|-----------------|---------|
| Main | api.blink.sv | Production |
| Staging | api.staging.blink.sv | Testing |
| Local | localhost:4455 | Development |

### Required Environment Variables
```bash
# For E2E testing
GALOY_TEST_TOKENS=...
GALOY_TOKEN_2=...
MAILSLURP_API_KEY=...
E2E_DEVICE=ios|android

# For Browserstack (optional)
BROWSERSTACK_USER=...
BROWSERSTACK_ACCESS_KEY=...
BROWSERSTACK_APP_ID=...
```
