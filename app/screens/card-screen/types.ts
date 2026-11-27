export type ShippingAddress = {
  firstName: string
  lastName: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  countryCode: string
}

export const CardDesign = {
  BlinkOrange: "Blink Orange",
} as const

export type CardDesignType = (typeof CardDesign)[keyof typeof CardDesign]

/** Cards ship by courier. Snail mail is shown, greyed, as an option not offered. */
export const Delivery = {
  Courier: "courier",
  SnailMail: "snailMail",
} as const

export type DeliveryType = (typeof Delivery)[keyof typeof Delivery]

export const EMPTY_ADDRESS: ShippingAddress = {
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
}

export const WalletAddResult = {
  Added: "added",
  Cancelled: "cancelled",
  Busy: "busy",
} as const

export type WalletAddResult = (typeof WalletAddResult)[keyof typeof WalletAddResult]

export type WalletCard = {
  cardId: string
  lastFour: string
}

/** The cardholder's address and phone on file, which Google Pay asks for so the user
 *  does not have to type them. An empty second line means there is none. */
export type CardholderAddress = {
  name: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  countryCode: string
  phoneNumber?: string
}

/** What a device wallet needs to take a card: the card as Rain's processor knows it, its
 *  short-lived secret, the name the wallet shows, and, for Google Pay, the cardholder's
 *  address when Rain has one. */
export type CardProvisioningData = {
  /** The id the wallet SDK takes, which is not the app's card id. */
  processorCardId: string
  cardSecret: string
  displayName: string
  address?: CardholderAddress
}

export type FetchCardProvisioningData = (cardId: string) => Promise<CardProvisioningData>

/** A wallet on the device that can take the card: Apple Pay on iOS, Google Pay on
 *  Android. */
export type DeviceWallet = {
  canAdd: (card: WalletCard) => Promise<boolean>
  add: (card: WalletCard, data: CardProvisioningData) => Promise<WalletAddResult>
}
