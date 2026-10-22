import { useCallback, useEffect, useMemo, useState } from "react"

import { gql } from "@apollo/client"
import {
  useOnChainAddressCreateMutation,
  useOnChainAddressCurrentMutation,
} from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

import { getPaymentRequestFullUri } from "../payment/helpers"
import { GetFullUriFn, Invoice } from "../payment/index.types"
import {
  NewOnchainAddressResult,
  type NewOnchainAddressResultType,
} from "../payment/request-state.types"

gql`
  mutation onChainAddressCurrent($input: OnChainAddressCurrentInput!) {
    onChainAddressCurrent(input: $input) {
      errors {
        message
      }
      address
    }
  }

  mutation onChainAddressCreate($input: OnChainAddressCreateInput!) {
    onChainAddressCreate(input: $input) {
      errors {
        message
        code
      }
      address
    }
  }
`

type UseOnChainAddressOptions = {
  amount?: number
  memo?: string
}

export const useOnChainAddress = (
  walletId: string | undefined,
  { amount, memo }: UseOnChainAddressOptions = {},
) => {
  const [onChainAddressCurrent] = useOnChainAddressCurrentMutation()
  const [onChainAddressCreate] = useOnChainAddressCreateMutation()
  const { LL } = useI18nContext()

  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(walletId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!walletId) return

    setError(null)
    setLoading(true)
    onChainAddressCurrent({
      variables: { input: { walletId } },
    })
      .then((result) => {
        const addr = result.data?.onChainAddressCurrent?.address
        if (addr) setAddress(addr)
      })
      .catch((err) => {
        const message = err?.message ?? "Unknown error"
        setError(message)
        toastShow({ message, LL, type: "warning" })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [walletId, onChainAddressCurrent, LL])

  /** Resolves Created once a fresh address is on screen; the old one keeps working. */
  const generateNewAddress =
    useCallback(async (): Promise<NewOnchainAddressResultType> => {
      if (!walletId) return NewOnchainAddressResult.Failed
      setLoading(true)
      try {
        const result = await onChainAddressCreate({
          variables: { input: { walletId } },
        })
        const payload = result.data?.onChainAddressCreate
        if (payload?.errors.some((err) => err.code === "TOO_MANY_REQUEST")) {
          return NewOnchainAddressResult.RateLimited
        }
        const addr = payload?.address
        if (!addr) return NewOnchainAddressResult.Failed
        setAddress(addr)
        return NewOnchainAddressResult.Created
      } catch {
        return NewOnchainAddressResult.Failed
      } finally {
        setLoading(false)
      }
    }, [walletId, onChainAddressCreate])

  const getFullUriFn = useMemo<GetFullUriFn | undefined>(() => {
    if (!address) return undefined
    return ({ uppercase, prefix }) =>
      getPaymentRequestFullUri({
        type: Invoice.OnChain,
        input: address,
        amount,
        memo,
        uppercase,
        prefix,
      })
  }, [address, amount, memo])

  return { address, loading, error, getFullUriFn, generateNewAddress }
}
