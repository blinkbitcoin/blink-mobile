# Technology Stack

## Project: blink-mobile (GaloyApp)

**Generated:** 2025-12-12

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | React Native | 0.76.9 | Cross-platform mobile development |
| Language | TypeScript | 5.4.5 | Type-safe JavaScript |
| Runtime | Node.js | >=20 | Build tooling and development |
| Package Manager | Yarn | - | Dependency management |

## Frontend Stack

### UI Framework
| Package | Version | Purpose |
|---------|---------|---------|
| @rn-vui/themed | - | Component library (RN Elements fork) |
| react-native-reanimated | - | Performant animations |
| react-native-gesture-handler | - | Touch gestures |
| react-native-svg | - | Vector graphics |
| react-native-safe-area-context | - | Safe area handling |
| victory-native | - | Charts and data visualization |

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
| graphql-tag | GraphQL template tags |

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
| bitcoinjs-lib | Bitcoin primitives |
| js-lnurl | LNURL protocol |
| lnurl-pay | LNURL payment |
| @blinkbitcoin/blink-client | Blink API client |
| bip21 | Bitcoin URI parsing |
| bip39 | Mnemonic phrases |

## Native Capabilities

### Camera & QR
| Package | Purpose |
|---------|---------|
| react-native-camera-kit | Camera access |
| @nickadamson/react-native-qrcode-svg | QR code generation |

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

**Supported Languages (28):**
af, ar, ca, cs, da, de, el, en, es, fr, hr, hu, hy, it, ja, ko, ms, nl, no, pl, pt, ro, ru, sv, th, tr, uk, zh

## Testing

| Package | Purpose |
|---------|---------|
| jest | Test runner |
| @testing-library/react-native | Component testing |
| detox | E2E testing |
| @wdio/cli | WebDriverIO |
| appium | Mobile automation |
| @storybook/react-native | Component documentation |

## Build & Development

### Development Environment
| Tool | Purpose |
|------|---------|
| Nix Flake | Reproducible dev environment |
| Direnv | Environment management |
| Metro | JavaScript bundler |

### CI/CD
| Tool | Purpose |
|------|---------|
| GitHub Actions | CI/CD workflows |
| Fastlane | iOS/Android deployment |
| Tilt | Local development orchestration |

### Build Tools
| Tool | Purpose |
|------|---------|
| Xcode 16.4 | iOS builds |
| Android SDK 35 | Android builds |
| JDK 17 | Android compilation |
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
yarn check-code     # Lint + type check
yarn lint           # ESLint
yarn tsc            # TypeScript check

# Code generation
yarn dev:codegen    # Generate GraphQL types
yarn update-translations  # Update i18n

# Storybook
yarn storybook      # Component docs
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
