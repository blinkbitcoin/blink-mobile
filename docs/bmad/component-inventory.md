# Blink Mobile Component Inventory

## Overview

The application uses an atomic design approach with reusable components organized by complexity and purpose. All components are located in `app/components/`.

## Atomic Components

Base UI elements that form the foundation of the design system.

### Buttons

| Component | Location | Purpose |
|-----------|----------|---------|
| `GaloyPrimaryButton` | `atomic/galoy-primary-button/` | Primary action buttons |
| `GaloySecondaryButton` | `atomic/galoy-secondary-button/` | Secondary action buttons |
| `GaloyTertiaryButton` | `atomic/galoy-tertiary-button/` | Tertiary/text buttons |
| `GaloyIconButton` | `atomic/galoy-icon-button/` | Icon-only buttons |
| `GaloySliderButton` | `atomic/galoy-slider-button/` | Slide-to-confirm buttons |
| `GaloyButtonField` | `atomic/galoy-button-field/` | Button with field styling |

### Form Elements

| Component | Location | Purpose |
|-----------|----------|---------|
| `GaloyInput` | `atomic/galoy-input/` | Text input fields |
| `GaloyRedesignedInput` | `atomic/galoy-input/` | Updated input design |
| `CodeInput` | `code-input/` | Verification code entry |
| `NoteInput` | `note-input/` | Transaction memo input |

### Display Elements

| Component | Location | Purpose |
|-----------|----------|---------|
| `GaloyIcon` | `atomic/galoy-icon/` | Icon wrapper component |
| `GaloyInfo` | `atomic/galoy-info/` | Info/tooltip display |
| `GaloyErrorBox` | `atomic/galoy-error-box/` | Error message display |
| `GaloyCurrencyBubble` | `atomic/galoy-currency-bubble/` | Currency indicator |
| `CurrencyTag` | `currency-tag/` | Currency type label |

## Layout Components

### Headers & Navigation

| Component | Location | Purpose |
|-----------|----------|---------|
| `BalanceHeader` | `balance-header/` | Wallet balance display |
| `MountainHeader` | `mountain-header/` | Decorative header |
| `HeaderBackControl` | `header-back-control/` | Navigation back button |

### Containers

| Component | Location | Purpose |
|-----------|----------|---------|
| `PressableCard` | `pressable-card/` | Touchable card container |
| `CustomModal` | `custom-modal/` | Modal dialog wrapper |
| `ModalTooltip` | `modal-tooltip/` | Tooltip modal |

## Feature Components

### Amount Input

| Component | Location | Purpose |
|-----------|----------|---------|
| `AmountInput` | `amount-input/` | Currency amount entry |
| `AmountInputButton` | `amount-input/` | Amount preset buttons |
| `AmountInputModal` | `amount-input/` | Modal amount entry |
| `AmountInputScreen` | `amount-input-screen/` | Full-screen amount entry |
| `AmountInputScreenUI` | `amount-input-screen/` | Amount screen UI layer |
| `CurrencyKeyboard` | `currency-keyboard/` | Custom numeric keyboard |

### Wallet Display

| Component | Location | Purpose |
|-----------|----------|---------|
| `WalletOverview` | `wallet-overview/` | Wallet card with balance |
| `WalletSummary` | `wallet-summary/` | Detailed wallet info |
| `Circle` | `circle/` | Circular progress/badge |

### Transaction Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `IconTransactions` | `icon-transactions/` | Transaction type icons |
| `TransactionDate` | `transaction-date/` | Transaction timestamp |

### Contact & Social

| Component | Location | Purpose |
|-----------|----------|---------|
| `ContactModal` | `contact-modal/` | Contact detail display |
| `IntroducingCirclesModal` | `introducing-circles-modal/` | Circles feature intro |
| `InviteModal` | `invite-modal/` | User invitation modal |

### Map Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `MapComponent` | `map-component/` | Map view wrapper |
| `LocationButtonCopy` | `map-component/` | Location copy button |
| `OpenSettingsModal` | `map-component/` | Location settings prompt |
| `MapMarkerComponent` | `map-marker-component/` | Custom map markers |

### Authentication

| Component | Location | Purpose |
|-----------|----------|---------|
| `TotpCopy` | `totp-export/` | TOTP secret copy |
| `TotpQR` | `totp-export/` | TOTP QR code display |

### Notifications

| Component | Location | Purpose |
|-----------|----------|---------|
| `NotificationsProvider` | `notifications/` | Notification context |
| `NotificationCardUI` | `notifications/` | Notification card display |
| `Bulletins` | `notifications/` | Bulletin announcements |
| `PushNotificationComponent` | `push-notification/` | FCM integration |

### Feedback & Status

| Component | Location | Purpose |
|-----------|----------|---------|
| `GaloyToast` | `galoy-toast/` | Toast notifications |
| `SuccessIconAnimation` | `success-animation/` | Animated success icon |
| `SuccessTextAnimation` | `success-animation/` | Animated success text |
| `SuccessAction` | `success-action/` | Success action display |
| `FieldWithCopy` | `success-action/` | Copyable field |

### Special Features

| Component | Location | Purpose |
|-----------|----------|---------|
| `ModalNfc` | `modal-nfc/` | NFC payment UI |
| `AppUpdate` | `app-update/` | App update prompts |
| `MayChallenge` | `may-challenge/` | May challenge card |
| `JuneChallenge` | `june-challenge/` | June challenge card |

### Selection & Options

| Component | Location | Purpose |
|-----------|----------|---------|
| `MenuSelect` | `menu-select/` | Dropdown menu |
| `MenuSelectItem` | `menu-select/` | Menu option item |
| `OptionSelector` | `option-selector/` | Option selection |
| `OptionIcon` | `option-selector/` | Option icon display |
| `ButtonGroup` | `button-group/` | Grouped button options |
| `ExpirationTimeChooser` | `expiration-time-chooser/` | Time selection |
| `ExpirationTimeButton` | `expiration-time-chooser/` | Time preset button |
| `ExpirationTimeModal` | `expiration-time-chooser/` | Time selection modal |
| `ExpirationTimeInput` | `expiration-time-chooser/` | Custom time input |

### Utility Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `GaloyThemeProvider` | `galoy-theme-provider/` | Theme context provider |
| `CustomIcon` | `custom-icon/` | Custom icon wrapper |
| `CloseCross` | `close-cross/` | Close button icon |
| `ContactSupportButton` | `contact-support-button/` | Support contact button |
| `SetDefaultAccountModal` | `set-default-account-modal/` | Default account selector |
| `SetLightningAddressModal` | `set-lightning-address-modal/` | LN address setup |
| `ActionsProvider` | `actions/` | App actions context |
| `ActionModals` | `actions/` | Action modal container |

## Component Patterns

### Storybook Stories

Most components have accompanying Storybook stories:

```
component-name/
├── component-name.tsx        # Main component
├── component-name.stories.tsx # Storybook stories
└── index.ts                   # Export
```

**Example story file:**
```tsx
// galoy-primary-button.stories.tsx
import { storiesOf } from "@storybook/react-native"
import { GaloyPrimaryButton } from "./galoy-primary-button"

storiesOf("Atomic/GaloyPrimaryButton", module)
  .add("Default", () => <GaloyPrimaryButton title="Press me" />)
  .add("Disabled", () => <GaloyPrimaryButton title="Disabled" disabled />)
```

### Theming

Components use `@rn-vui/themed` for consistent styling:

```tsx
import { makeStyles, useTheme } from "@rn-vui/themed"

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.white,
    borderColor: colors.grey4,
  },
}))

const MyComponent = () => {
  const styles = useStyles()
  const { theme: { colors } } = useTheme()
  // ...
}
```

### Test Props Helper

Components support E2E testing via accessibility labels:

```tsx
import { testProps } from "@app/utils/testProps"

<Button {...testProps("submit-button")} title="Submit" />
```

The `testProps` function returns:
```tsx
{
  testID: "submit-button",
  accessible: true,
  accessibilityLabel: "submit-button",
}
```

## Design System Notes

### Color Tokens

Colors accessed via theme:
- `colors.primary` - Primary brand color
- `colors.black` / `colors.white` - Text colors
- `colors.grey1` - `colors.grey5` - Gray scale
- `colors.error` - Error state
- `colors.success` - Success state
- `colors._blue`, `colors._white` - Special colors

### Icon System

Icons are SVG files transformed by `react-native-svg-transformer`:

```
app/assets/
├── icons/           # Original icon set
└── icons-redesign/  # Updated icon designs
```

Usage:
```tsx
import HomeIcon from "@app/assets/icons/home.svg"

<HomeIcon fill={color} width={24} height={24} />
```

### Typography

Typography handled by theme and platform defaults. Custom fonts in:
- `app/assets/fonts/`

Linked via `yarn fonts` command.

## Component Count Summary

| Category | Count |
|----------|-------|
| Atomic Components | 12 |
| Layout Components | 5 |
| Form Components | 4 |
| Amount/Currency | 6 |
| Wallet/Transaction | 4 |
| Map Components | 4 |
| Notification Components | 4 |
| Modal Components | 8 |
| Selection Components | 8 |
| Utility Components | 10+ |
| **Total Modules** | **55+** |

---

*Generated by BMAD Document Project Workflow*
