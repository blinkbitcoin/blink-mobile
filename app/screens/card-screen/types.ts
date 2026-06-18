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
