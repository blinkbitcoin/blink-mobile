# Blink Mobile Source Tree Analysis

## Project Root Structure

```
blink-mobile/
├── app/                    # Main application source code
│   ├── app.tsx            # 🚀 App entry point with provider hierarchy
│   ├── assets/            # Static assets (fonts, icons, images, logos)
│   ├── components/        # Reusable UI components (55+ modules)
│   ├── config/            # App configuration (feature flags, instances)
│   ├── graphql/           # GraphQL client, queries, generated types
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Internationalization (25+ languages)
│   ├── navigation/        # React Navigation setup
│   ├── rne-theme/         # Theme configuration
│   ├── screens/           # Feature screens (29+ modules)
│   ├── store/             # Persistent state management
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
│
├── __tests__/             # Unit tests
├── __mocks__/             # Jest mocks
├── android/               # Android native project
├── ios/                   # iOS native project
├── e2e/                   # E2E tests (Detox & Appium)
├── dev/                   # Development utilities
├── ci/                    # CI scripts
├── docs/                  # Documentation
├── patches/               # Patch-package patches
│
├── index.js               # 🚀 React Native entry point
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── codegen.yml            # GraphQL code generation config
├── babel.config.js        # Babel configuration
├── metro.config.js        # Metro bundler configuration
├── jest.config.js         # Jest test configuration
├── .detoxrc.js            # Detox E2E configuration
├── flake.nix              # Nix development environment
└── CLAUDE.md              # AI assistant instructions
```

## Critical Directories

### `/app` - Application Source

The main application code organized by concern:

```
app/
├── app.tsx                        # Root component - Provider hierarchy
│                                  # GestureHandler → PersistentState → i18n →
│                                  # GaloyClient → Theme → FeatureFlags → Navigation
│
├── assets/                        # Static assets
│   ├── fonts/                     # Custom fonts (7 files)
│   ├── icons/                     # SVG icons (45+ files)
│   ├── icons-redesign/            # Updated icons (55+ files)
│   ├── images/                    # Image assets
│   └── logo/                      # App logos
│
├── components/                    # Reusable components (55+ modules)
│   ├── atomic/                    # Base UI elements
│   │   ├── galoy-button-field/
│   │   ├── galoy-currency-bubble/
│   │   ├── galoy-error-box/
│   │   ├── galoy-icon/
│   │   ├── galoy-icon-button/
│   │   ├── galoy-info/
│   │   ├── galoy-input/
│   │   ├── galoy-primary-button/
│   │   ├── galoy-secondary-button/
│   │   ├── galoy-slider-button/
│   │   └── galoy-tertiary-button/
│   ├── amount-input/              # Currency amount input
│   ├── amount-input-screen/       # Full-screen amount input
│   ├── app-update/                # App update prompts
│   ├── balance-header/            # Balance display component
│   ├── button-group/              # Button group component
│   ├── circle/                    # Circle UI element
│   ├── code-input/                # Verification code input
│   ├── contact-modal/             # Contact detail modal
│   ├── currency-keyboard/         # Custom numeric keyboard
│   ├── custom-modal/              # Modal wrapper
│   ├── galoy-toast/               # Toast notifications
│   ├── galoy-theme-provider/      # Theme context
│   ├── map-component/             # Map integration
│   ├── map-marker-component/      # Map markers
│   ├── modal-nfc/                 # NFC payment modal
│   ├── notifications/             # Push notification handling
│   ├── push-notification/         # FCM integration
│   ├── success-animation/         # Success feedback
│   ├── totp-export/               # TOTP QR export
│   ├── wallet-overview/           # Wallet summary
│   └── wallet-summary/            # Wallet details
│
├── config/                        # Configuration
│   ├── index.ts                   # Config constants
│   ├── appinfo.ts                 # App info utilities
│   ├── feature-flags-context.tsx  # Feature flag provider
│   └── galoy-instances.ts         # Backend instance config
│                                  # Main: api.blink.sv
│                                  # Staging: api.staging.blink.sv
│                                  # Local: localhost:4455
│
├── graphql/                       # GraphQL layer
│   ├── client.tsx                 # 🔑 Apollo Client setup
│   │                              # - Auth headers, App Check
│   │                              # - WebSocket for subscriptions
│   │                              # - Cache persistence
│   │                              # - Retry logic
│   ├── generated.ts               # 🤖 Auto-generated types & hooks
│   ├── cache.ts                   # Apollo cache configuration
│   ├── fragments.ts               # GraphQL fragments
│   ├── transactions.ts            # Transaction utilities
│   ├── error-code.ts              # Error handling
│   ├── is-authed-context.ts       # Auth state context
│   ├── level-context.ts           # Account level context
│   ├── ln-update-context.ts       # Lightning update context
│   ├── network-error-context.ts   # Network error context
│   └── mocks.ts                   # Test mocks
│
├── hooks/                         # Custom hooks
│   ├── index.ts                   # Hook exports
│   ├── use-app-config.ts          # App configuration
│   ├── use-device-location.ts     # Geolocation
│   ├── use-display-currency.ts    # Currency display
│   ├── use-geetest-captcha.ts     # Captcha integration
│   ├── use-logout.ts              # Logout logic
│   ├── use-price-conversion.ts    # Price conversion
│   ├── use-save-session-profile.ts # Session management
│   └── use-show-upgrade-modal.ts  # Upgrade prompts
│
├── i18n/                          # Internationalization
│   ├── en/index.ts                # 🌐 English translations (source)
│   ├── i18n-types.ts              # 🤖 Auto-generated types
│   ├── i18n-react.tsx             # React integration
│   ├── i18n-util.*.ts             # i18n utilities
│   ├── formatters.ts              # Number/date formatters
│   ├── mapping.ts                 # Language mappings
│   ├── raw-i18n/                  # Raw translation files (managed)
│   └── [lang]/                    # 25+ language directories
│       └── index.ts               # Language translations
│
├── navigation/                    # Navigation
│   ├── root-navigator.tsx         # 🚀 Main navigation structure
│   ├── stack-param-lists.ts       # Navigation type definitions
│   ├── navigation-container-wrapper.tsx
│   └── app-state.tsx              # App state wrapper
│
├── rne-theme/                     # Theming
│   ├── index.ts                   # Theme exports
│   └── theme.ts                   # Theme definitions
│
├── screens/                       # Feature screens (29+ modules)
│   ├── accept-t-and-c/            # Terms acceptance
│   ├── authentication-screen/     # Auth flow
│   ├── conversion-flow/           # Currency conversion
│   ├── developer-screen/          # Developer options
│   ├── earns-map-screen/          # Earn feature map
│   ├── earns-screen/              # Educational content
│   ├── email-login-screen/        # Email auth
│   ├── email-registration-screen/ # Email signup
│   ├── error-screen/              # Error display
│   ├── full-onboarding-flow/      # Complete onboarding
│   ├── galoy-address-screen/      # Lightning address
│   ├── get-started-screen/        # Welcome screen
│   ├── home-screen/               # 🏠 Main dashboard
│   ├── lightning-address-screen/  # LN address setup
│   ├── map-screen/                # Merchant map
│   ├── notification-history-screen/ # Notification log
│   ├── onboarding-screen/         # Onboarding steps
│   ├── people-screen/             # Contacts & Circles
│   ├── phone-auth-screen/         # Phone verification
│   ├── price/                     # Price history
│   ├── receive-bitcoin-screen/    # Receive flow
│   ├── redeem-lnurl-withdrawal-screen/
│   ├── send-bitcoin-screen/       # Send flow
│   │   ├── payment-destination/   # Address input
│   │   └── payment-details/       # Amount/confirm
│   ├── settings-screen/           # Settings
│   │   ├── account/               # Account settings
│   │   └── settings/              # General settings
│   ├── support-chat-screen/       # Support chat
│   ├── telegram-login-screen/     # Telegram auth
│   ├── totp-screen/               # 2FA setup
│   ├── transaction-detail-screen/ # Transaction details
│   ├── transaction-history/       # Transaction list
│   └── webview/                   # In-app browser
│
├── store/                         # State management
│   └── persistent-state/
│       ├── index.tsx              # PersistentStateProvider
│       └── state-migrations.ts    # State migration logic
│
├── types/                         # Type definitions
│   └── *.d.ts                     # TypeScript declarations
│
└── utils/                         # Utilities
    ├── helper.ts                  # General helpers
    ├── storage.ts                 # AsyncStorage wrapper
    ├── logs.ts                    # Logging setup
    ├── locale-detector.ts         # Language detection
    └── testProps.ts               # E2E test helpers
```

### `/android` - Android Project

```
android/
├── app/
│   ├── build.gradle               # App-level build config
│   ├── google-services.json       # Firebase config
│   └── src/main/
│       ├── AndroidManifest.xml    # App manifest
│       ├── java/                  # Native Java code
│       ├── res/                   # Android resources
│       └── assets/fonts/          # Font assets
├── build.gradle                   # Project-level build config
├── gradle.properties              # Gradle properties
├── settings.gradle                # Project settings
└── fastlane/                      # Android deployment
```

### `/ios` - iOS Project

```
ios/
├── GaloyApp/
│   ├── Info.plist                 # App configuration
│   ├── AppDelegate.mm             # App delegate
│   └── *.entitlements             # App entitlements
├── GaloyApp.xcodeproj/            # Xcode project
├── GaloyApp.xcworkspace/          # Xcode workspace (use this)
├── Podfile                        # CocoaPods dependencies
├── Podfile.lock                   # Locked pod versions
├── GoogleService-Info.plist       # Firebase config
├── Gemfile                        # Ruby dependencies
└── fastlane/                      # iOS deployment
```

### `/e2e` - E2E Testing

```
e2e/
├── config/
│   ├── wdio.conf.js               # WebdriverIO config
│   ├── browserstack.conf.js       # BrowserStack config
│   └── story-book.wdio.conf.js    # Storybook testing
├── helpers/                       # Test helpers
├── 01-*.e2e.ts                    # Test specs (ordered)
└── utils/                         # Test utilities
```

### `/__tests__` - Unit Tests

```
__tests__/
├── components/                    # Component tests
├── currencies/                    # Currency logic tests
├── hooks/                         # Hook tests
├── lnurl.spec.ts                  # LNURL tests
├── payment-destination/           # Payment destination tests
├── payment-details/               # Payment details tests
├── payment-request/               # Payment request tests
├── persistent-storage.spec.ts     # Storage tests
├── receive-bitcoin/               # Receive flow tests
└── screens/                       # Screen tests
```

## Key Files Reference

| File | Location | Purpose |
|------|----------|---------|
| App Entry | `app/app.tsx` | Root component with providers |
| RN Entry | `index.js` | React Native registration |
| Navigation | `app/navigation/root-navigator.tsx` | Screen routing |
| GraphQL Client | `app/graphql/client.tsx` | Apollo setup |
| Generated Types | `app/graphql/generated.ts` | GraphQL types/hooks |
| State Provider | `app/store/persistent-state/index.tsx` | Local state |
| Translations | `app/i18n/en/index.ts` | i18n source |
| Instances | `app/config/galoy-instances.ts` | Backend URLs |
| Package Config | `package.json` | Dependencies |
| TS Config | `tsconfig.json` | TypeScript settings |
| GraphQL Codegen | `codegen.yml` | Type generation |

---

*Generated by BMAD Document Project Workflow*
