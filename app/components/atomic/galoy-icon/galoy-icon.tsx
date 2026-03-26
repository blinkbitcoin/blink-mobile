import React from "react"
import { StyleProp, View, ViewStyle } from "react-native"

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsDownUpIcon,
  ArrowsClockwiseIcon,
  ArrowSquareOutIcon,
  BackspaceIcon,
  BankIcon,
  BellIcon,
  BookIcon,
  BookOpenIcon,
  CalculatorIcon,
  CalendarIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpIcon,
  ChartLineIcon,
  ChatCircleDotsIcon,
  CheckIcon,
  CheckCircleIcon,
  ClipboardIcon,
  CoinsIcon,
  CopyIcon,
  CurrencyDollarIcon,
  DownloadSimpleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  FileIcon,
  FlagIcon,
  FingerprintSimpleIcon,
  FunnelIcon,
  GaugeIcon,
  GearSixIcon,
  GlobeIcon,
  HeadsetIcon,
  HouseIcon,
  ImageIcon,
  InfoIcon,
  KeyIcon,
  LightbulbIcon,
  LightningIcon,
  LinkIcon,
  ListIcon,
  LockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MapTrifoldIcon,
  MinusIcon,
  NoteIcon,
  PackageIcon,
  PaintBrushIcon,
  PencilSimpleLineIcon,
  PhoneIcon,
  PlusIcon,
  QuestionIcon,
  ScanIcon,
  ShareNetworkIcon,
  ShieldIcon,
  SnowflakeIcon,
  SpinnerGapIcon,
  StorefrontIcon,
  TrashIcon,
  TranslateIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  VideoIcon,
  WalletIcon,
  WarningCircleIcon,
  WarningIcon,
  XIcon,
  XCircleIcon,
} from "phosphor-react-native"

import ApplePay from "@app/assets/icons/apple-pay.svg"
import Bitcoin from "@app/assets/icons-redesign/bitcoin.svg"
import BlinkIcon from "@app/assets/icons-redesign/blink-icon.svg"
import BtcBook from "@app/assets/icons-redesign/btc-book.svg"
import CloseCrossWithBackground from "@app/assets/icons-redesign/close-cross-with-background.svg"
import GooglePay from "@app/assets/icons/google-pay.svg"
import LightningAddress from "@app/assets/icons-redesign/lightning-address.svg"
import PaymentError from "@app/assets/icons-redesign/payment-error.svg"
import PaymentPending from "@app/assets/icons-redesign/payment-pending.svg"
import PaymentSuccess from "@app/assets/icons-redesign/payment-success.svg"
import PhysicalCard from "@app/assets/icons-redesign/physical-card.svg"
import PrivacyPolicy from "@app/assets/icons-redesign/privacy-policy.svg"
import Telegram from "@app/assets/icons/telegram.svg"
import TelegramSimple from "@app/assets/icons-redesign/telegram-simple.svg"
import VisaPlatinum from "@app/assets/icons-redesign/visa-platinum.svg"
import WarningWithBackground from "@app/assets/icons-redesign/warning-with-background.svg"
import Welcome from "@app/assets/icons-redesign/welcome.svg"
import Receive from "@app/assets/icons-redesign/receive.svg"
import Send from "@app/assets/icons-redesign/send.svg"
import Upgrade from "@app/assets/icons-redesign/upgrade.svg"
import QrCode from "@app/assets/icons-redesign/qr-code.svg"
import BtcHand from "@app/assets/icons-redesign/btc-hand.svg"
import CheckBadge from "@app/assets/icons-redesign/check-badge.svg"
import HeartOutline from "@app/assets/icons-redesign/heart-outline.svg"
import NostrWalletConnect from "@app/assets/icons/nostr-wallet-connect.svg"

import { makeStyles, useTheme } from "@rn-vui/themed"

// ── Size presets ────────────────────────────────────────────────────────────

export type IconSizeVariant = "sm" | "md" | "lg" | "xl"

export const ICON_SIZES = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
} as const

// ── Weight presets ──────────────────────────────────────────────────────────

export type IconWeight = "thin" | "regular" | "bold"

// ── Icon maps ───────────────────────────────────────────────────────────────

const phosphorIconMap = {
  "arrow-down": ArrowDownIcon,
  "arrow-left": ArrowLeftIcon,
  "arrow-right": ArrowRightIcon,
  "arrow-square-out": ArrowSquareOutIcon,
  "back-space": BackspaceIcon,
  "bank": BankIcon,
  "bell": BellIcon,
  "book": BookIcon,
  "brush": PaintBrushIcon,
  "book-open": BookOpenIcon,
  "calculator": CalculatorIcon,
  "calendar": CalendarIcon,
  "caret-down": CaretDownIcon,
  "caret-left": CaretLeftIcon,
  "caret-right": CaretRightIcon,
  "caret-up": CaretUpIcon,
  "chat": ChatCircleDotsIcon,
  "check": CheckIcon,
  "clipboard": ClipboardIcon,
  "check-circle": CheckCircleIcon,
  "coins": CoinsIcon,
  "document-outline": FileIcon,
  "dollar": CurrencyDollarIcon,
  "download": DownloadSimpleIcon,
  "email-add": EnvelopeIcon,
  "error": XCircleIcon,
  "eye": EyeIcon,
  "eye-slash": EyeSlashIcon,
  "fingerprint": FingerprintSimpleIcon,
  "filter": FunnelIcon,
  "globe": GlobeIcon,
  "graph": ChartLineIcon,
  "headset": HeadsetIcon,
  "house-outline": HouseIcon,
  "image": ImageIcon,
  "info": InfoIcon,
  "key-outline": KeyIcon,
  "lightbulb": LightbulbIcon,
  "lightning": LightningIcon,
  "link": LinkIcon,
  "loading": SpinnerGapIcon,
  "lock-closed": LockIcon,
  "magnifying-glass": MagnifyingGlassIcon,
  "map": MapTrifoldIcon,
  "map-pin": MapPinIcon,
  "menu": ListIcon,
  "minus": MinusIcon,
  "note": NoteIcon,
  "pencil": PencilSimpleLineIcon,
  "people": UsersIcon,
  "phone": PhoneIcon,
  "plus": PlusIcon,
  "question": QuestionIcon,
  "rank": TrophyIcon,
  "refresh": ArrowsClockwiseIcon,
  "report-flag": FlagIcon,
  "scan": ScanIcon,
  "settings": GearSixIcon,
  "share": ShareNetworkIcon,
  "shield": ShieldIcon,
  "snowflake": SnowflakeIcon,
  "speedometer": GaugeIcon,
  "storefront": StorefrontIcon,
  "support": HeadsetIcon,
  "transfer": ArrowsDownUpIcon,
  "translate": TranslateIcon,
  "trash": TrashIcon,
  "user": UserIcon,
  "video": VideoIcon,
  "wallet": WalletIcon,
  "warning": WarningIcon,
  "warning-circle": WarningCircleIcon,
  "close": XIcon,
  "copy-paste": CopyIcon,
  "delivery": PackageIcon,
  "approved": CheckCircleIcon,
} as const

const customSvgMap = {
  "apple-pay": ApplePay,
  "bitcoin": Bitcoin,
  "blink-icon": BlinkIcon,
  "btc-book": BtcBook,
  "close-cross-with-background": CloseCrossWithBackground,
  "google-pay": GooglePay,
  "lightning-address": LightningAddress,
  "payment-error": PaymentError,
  "payment-pending": PaymentPending,
  "payment-success": PaymentSuccess,
  "physical-card": PhysicalCard,
  "privacy-policy": PrivacyPolicy,
  "telegram": Telegram,
  "telegram-simple": TelegramSimple,
  "receive": Receive,
  "send": Send,
  "upgrade": Upgrade,
  "visa-platinum": VisaPlatinum,
  "warning-with-background": WarningWithBackground,
  "welcome": Welcome,
  "qr-code": QrCode,
  "btc-hand": BtcHand,
  "check-badge": CheckBadge,
  "heart-outline": HeartOutline,
  "nostr-wallet-connect": NostrWalletConnect,
} as const

export const icons = { ...phosphorIconMap, ...customSvgMap } as const

export type IconNamesType = keyof typeof icons
export const IconNames = Object.keys(icons)

// ── Props ───────────────────────────────────────────────────────────────────

/** Mutually exclusive size specification: numeric `size`, a preset `sizeVariant`, or explicit `width`/`height`. */
type IconSizeProps =
  | { size: number; sizeVariant?: never; width?: never; height?: never }
  | { size?: never; sizeVariant: IconSizeVariant; width?: never; height?: never }
  | { size?: never; sizeVariant?: never; width: number; height: number }

type GaloyIconProps = {
  name: IconNamesType
  color?: string
  style?: StyleProp<ViewStyle>
  backgroundColor?: string
  opacity?: number
  containerSize?: number
  weight?: IconWeight
} & IconSizeProps

// ── Helpers ─────────────────────────────────────────────────────────────────

export const circleDiameterThatContainsSquare = (squareSize: number) => {
  const SQRT2 = 1.414
  return Math.round(squareSize * SQRT2)
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Unified icon component supporting two rendering strategies:
 *
 * - **Phosphor icons** — vector icons from `phosphor-react-native`, looked up via
 *   `phosphorIconMap`. Supports `size`, `color`, and `weight` props natively.
 *
 * - **Custom SVGs** — project-specific SVG assets (e.g. payment status, brand logos),
 *   looked up via `customSvgMap`. Rendered via `react-native-svg`.
 *
 * Icon resolution falls back to the custom SVG map when the name is not found in the
 * Phosphor map. Use `IconNamesType` (derived from both maps) for type-safe name values.
 */
export const GaloyIcon = ({
  name,
  size,
  sizeVariant,
  width,
  height,
  color,
  style,
  backgroundColor,
  opacity,
  containerSize,
  weight = "regular",
}: GaloyIconProps) => {
  const {
    theme: { colors },
  } = useTheme()

  const resolvedSize =
    size ??
    (sizeVariant ? ICON_SIZES[sizeVariant] : undefined) ??
    Math.max(width ?? 0, height ?? 0)
  const resolvedColor = color || colors.black

  const styles = useStyles({
    backgroundColor,
    opacity,
    size: resolvedSize,
    containerSize,
  })

  if (name in phosphorIconMap) {
    const PhosphorIcon = phosphorIconMap[name as keyof typeof phosphorIconMap]
    if (backgroundColor) {
      return (
        <View style={[style, styles.iconContainerStyle]}>
          <PhosphorIcon
            size={resolvedSize}
            color={resolvedColor}
            weight={weight}
            testID={`icon-${name}`}
          />
        </View>
      )
    }
    return (
      <PhosphorIcon
        size={resolvedSize}
        color={resolvedColor}
        weight={weight}
        style={[style, { opacity: opacity || 1 }]}
        testID={`icon-${name}`}
      />
    )
  }

  const SvgIcon = customSvgMap[name as keyof typeof customSvgMap]
  if (backgroundColor) {
    return (
      <View style={[style, styles.iconContainerStyle]}>
        <SvgIcon
          width={resolvedSize}
          height={resolvedSize}
          color={resolvedColor}
          testID={`icon-${name}`}
        />
      </View>
    )
  }
  return (
    <SvgIcon
      opacity={opacity || 1}
      width={size ?? width}
      height={size ?? height}
      color={resolvedColor}
      style={style}
      testID={`icon-${name}`}
    />
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

type UseStylesProps = {
  backgroundColor?: string
  opacity?: number
  size: number
  containerSize?: number
}

const useStyles = makeStyles(
  (_, { backgroundColor, opacity, size, containerSize }: UseStylesProps) => {
    const resolvedContainerSize = containerSize ?? circleDiameterThatContainsSquare(size)
    return {
      iconContainerStyle: {
        opacity: opacity || 1,
        backgroundColor,
        borderRadius: resolvedContainerSize,
        width: resolvedContainerSize,
        height: resolvedContainerSize,
        alignItems: "center",
        justifyContent: "center",
      },
    }
  },
)
