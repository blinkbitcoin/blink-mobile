import { ShippingAddress as GqlShippingAddress } from "@app/graphql/generated"

export type AddressFields = Pick<
  GqlShippingAddress,
  | "firstName"
  | "lastName"
  | "line1"
  | "line2"
  | "city"
  | "region"
  | "postalCode"
  | "country"
  | "countryCode"
>

export const addressToLines = (
  address: AddressFields,
  includeFullName = true,
): string[] =>
  [
    includeFullName
      ? [address.firstName, address.lastName].filter(Boolean).join(" ") || null
      : null,
    address.line1,
    address.line2 || null,
    `${address.city}, ${address.region} ${address.postalCode}`,
    address.country ?? address.countryCode,
  ].filter((line): line is string => line !== null)
