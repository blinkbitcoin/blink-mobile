import { ShippingAddress } from "@app/screens/card-screen/types"

const countryLabels: Record<string, string> = { US: "United States", CA: "Canada" }

export const mockAddressToLines = (
  address: ShippingAddress,
  includeFullName = true,
): string[] => {
  const lines: string[] = []
  if (includeFullName) {
    const name = [address.firstName, address.lastName].filter(Boolean).join(" ")
    if (name) lines.push(name)
  }
  lines.push(address.line1)
  if (address.line2) lines.push(address.line2)
  lines.push(
    [address.city, address.region, address.postalCode].filter(Boolean).join(", "),
  )
  lines.push(countryLabels[address.countryCode] ?? address.countryCode)
  return lines
}
