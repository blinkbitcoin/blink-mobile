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
  MaxiOrange: "Maxi orange",
} as const

export type CardDesignType = (typeof CardDesign)[keyof typeof CardDesign]

export const Delivery = {
  Standard: "standard",
  Express: "express",
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
