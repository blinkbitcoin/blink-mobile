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

export type ShippingAddress = {
  fullName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
}

/*
 * TODO: remove when all screens use addressToLines from utils/address.ts
 * Currently used by:
 * - order-card-screens/steps/confirm-step.tsx
 * - order-card-screens/steps/shipping-step.tsx
 * - replace-card-screens/steps/delivery-step.tsx
 */
export const shippingAddressToLines = (
  address: ShippingAddress,
  includeFullName = true,
): string[] =>
  [
    includeFullName ? address.fullName : null,
    address.addressLine1,
    address.addressLine2 || null,
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country,
  ].filter((line): line is string => line !== null)

export type UserInfo = {
  dateOfBirth: string
  registeredAddress: ShippingAddress
}

export const MOCK_USER: UserInfo = {
  dateOfBirth: "1971-01-03",
  registeredAddress: {
    fullName: "Satoshi Nakamoto",
    addressLine1: "123 Main Street",
    addressLine2: "Apt 4B",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "United States",
  },
}

export const MOCK_SHIPPING_ADDRESS: ShippingAddress = {
  fullName: "Joe Nakamoto",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  city: "New York",
  state: "NY",
  postalCode: "10001",
  country: "USA",
}

export type SelectionOption = {
  value: string
  label: string
}

export const US_STATES: SelectionOption[] = [
  { value: "AZ", label: "Arizona" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "IL", label: "Illinois" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "NV", label: "Nevada" },
  { value: "NJ", label: "New Jersey" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "OH", label: "Ohio" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
]

export const COUNTRIES: SelectionOption[] = [
  { value: "USA", label: "United States" },
  { value: "CAN", label: "Canada" },
  { value: "MEX", label: "Mexico" },
]

export const MOCK_CARD_PIN = "1234"
