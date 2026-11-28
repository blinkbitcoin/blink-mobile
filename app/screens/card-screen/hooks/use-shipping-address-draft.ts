import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react"

import useDeviceLocation from "@app/hooks/use-device-location"
import { ShippingAddress } from "@app/screens/card-screen/types"
import { getRegionsByCountry } from "@app/utils/address-metadata"

const FALLBACK_COUNTRY = "US"

const firstRegionOf = (countryCode: string) =>
  getRegionsByCountry(countryCode)[0]?.value ?? ""

const emptyAddressIn = (countryCode: string, cardholder: ShippingAddress | null) => ({
  firstName: cardholder?.firstName ?? "",
  lastName: cardholder?.lastName ?? "",
  line1: "",
  line2: "",
  city: "",
  region: firstRegionOf(countryCode),
  postalCode: "",
  countryCode,
})

/** A new shipping address. The member is invited to send the card somewhere other than
 *  home (D42), so it never starts as the address on file: it takes the cardholder's name,
 *  empty lines and the country the device is in. What the member types wins over what
 *  arrives later. */
export const useShippingAddressDraft = (
  cardholder: ShippingAddress | null,
): [ShippingAddress, Dispatch<SetStateAction<ShippingAddress>>] => {
  const { countryCode: detectedCountry } = useDeviceLocation()
  const [draft, setDraft] = useState<ShippingAddress>(() =>
    emptyAddressIn(FALLBACK_COUNTRY, cardholder),
  )
  const hasNameRef = useRef(cardholder !== null)
  const isCountrySettledRef = useRef(false)

  /** The cardholder can arrive after the first render, with the card data. It fills only
   *  the name fields the member left empty. */
  useEffect(() => {
    if (hasNameRef.current || !cardholder) return

    hasNameRef.current = true
    setDraft((prev) => ({
      ...prev,
      firstName: prev.firstName || cardholder.firstName,
      lastName: prev.lastName || cardholder.lastName,
    }))
  }, [cardholder])

  /** The device location can resolve after the member starts the address. Once they edit
   *  it, the country stays theirs: a late result would pair the city or postal code they
   *  typed with another country's region. */
  useEffect(() => {
    if (isCountrySettledRef.current) return
    if (!detectedCountry || detectedCountry === FALLBACK_COUNTRY) return

    isCountrySettledRef.current = true
    setDraft((prev) => ({
      ...prev,
      countryCode: detectedCountry,
      region: firstRegionOf(detectedCountry),
    }))
  }, [detectedCountry])

  const editDraft = useCallback<Dispatch<SetStateAction<ShippingAddress>>>((value) => {
    isCountrySettledRef.current = true
    setDraft(value)
  }, [])

  return [draft, editDraft]
}
