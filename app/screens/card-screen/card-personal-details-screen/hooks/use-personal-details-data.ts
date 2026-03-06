import { useEffect } from "react"
import { gql } from "@apollo/client"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { usePersonalDetailsQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

gql`
  query personalDetails {
    me {
      id
      phone
      email {
        address
      }
      defaultAccount {
        ... on ConsumerAccount {
          id
          firstName
          lastName
          onboardingStatus
          cards {
            id
            shippingAddress {
              firstName
              lastName
              line1
              line2
              city
              region
              postalCode
              country
              countryCode
            }
          }
        }
      }
    }
  }
`

export const usePersonalDetailsData = () => {
  const isAuthed = useIsAuthed()
  const { LL } = useI18nContext()

  const { data, loading, error } = usePersonalDetailsQuery({
    skip: !isAuthed,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  })

  const me = data?.me
  const account = me?.defaultAccount
  const firstName = account?.firstName ?? ""
  const lastName = account?.lastName ?? ""
  const fullName = [firstName, lastName].filter(Boolean).join(" ")

  const shippingAddress = account?.cards?.[0]?.shippingAddress ?? null

  useEffect(() => {
    if (error) {
      toastShow({ message: error.message, type: "warning", LL })
    }
  }, [error, LL])

  return {
    firstName,
    lastName,
    fullName,
    onboardingStatus: account?.onboardingStatus ?? null,
    email: me?.email?.address ?? "",
    phone: me?.phone ?? "",
    shippingAddress,
    loading,
    error,
  }
}
