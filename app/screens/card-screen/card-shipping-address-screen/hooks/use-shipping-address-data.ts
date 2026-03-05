import { useEffect } from "react"

import { usePersonalDetailsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

export const useShippingAddressData = () => {
  const isAuthed = useIsAuthed()
  const { LL } = useI18nContext()

  const { data, loading, error } = usePersonalDetailsQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-first",
  })

  useEffect(() => {
    if (error) {
      toastShow({ message: error.message, type: "warning", LL })
    }
  }, [error, LL])

  const shippingAddress = data?.me?.defaultAccount?.cards?.[0]?.shippingAddress
  if (!shippingAddress)
    return {
      initialAddress: null,
      loading,
    }

  const { firstName, lastName, line1, line2, city, region, postalCode, countryCode } =
    shippingAddress

  return {
    initialAddress: {
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      line1,
      line2: line2 ?? "",
      city,
      region,
      postalCode,
      countryCode,
    },
    loading,
  }
}
