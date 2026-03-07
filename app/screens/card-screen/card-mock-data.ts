import { ShippingAddress } from "./types"

export const CardStatus = {
  Active: "active",
  Frozen: "frozen",
  Inactive: "inactive",
} as const

export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus]

export type CardInfo = {
  cardNumber: string
  holderName: string
  validThruDate: string
  cvv: string
  expiryDate: string
  cardType: string
  status: CardStatus
  issuedDate: string
  network: string
}

export const MOCK_CARD: CardInfo = {
  cardNumber: "2121 2121 2121 2121",
  holderName: "SATOSHI NAKAMOTO",
  validThruDate: "2028-12-01",
  cvv: "123",
  expiryDate: "09/29",
  cardType: "Virtual Visa debit",
  status: CardStatus.Active,
  issuedDate: "April 23, 2025",
  network: "Visa",
}

export type UserInfo = {
  dateOfBirth: string
  registeredAddress: ShippingAddress
}

export const MOCK_USER: UserInfo = {
  dateOfBirth: "1971-01-03",
  registeredAddress: {
    firstName: "Satoshi",
    lastName: "Nakamoto",
    line1: "123 Main Street",
    line2: "Apt 4B",
    city: "New York",
    region: "NY",
    postalCode: "10001",
    countryCode: "USA",
  },
}

export const MOCK_SHIPPING_ADDRESS: ShippingAddress = {
  firstName: "Joe",
  lastName: "Nakamoto",
  line1: "Address line 1",
  line2: "Address line 2",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "USA",
}
