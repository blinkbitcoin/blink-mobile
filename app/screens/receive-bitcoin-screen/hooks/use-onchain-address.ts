import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { gql } from "@apollo/client"
import {
  useOnChainAddressCreateMutation,
  useOnChainAddressCurrentMutation,
} from "@app/graphql/generated"
import { reportError } from "@app/utils/error-logging"

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

const RATE_LIMITED_CODE = "TOO_MANY_REQUEST"

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

  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(walletId))
  const [error, setError] = useState<string | null>(null)
  // The fetch settled without an address: nothing more is coming until the user retries.
  const [failed, setFailed] = useState(false)
  // Only the latest fetch or create may write; a late answer may belong to another wallet.
  const generationRef = useRef(0)

  useEffect(() => {
    generationRef.current += 1
    const generation = generationRef.current
    // The address held so far belongs to the previous wallet: never show, copy or
    // share it on this one, even while this wallet's address is loading.
    setAddress(null)
    setError(null)
    setFailed(false)
    if (!walletId) {
      setLoading(false)
      return
    }
    const isCurrent = () => generation === generationRef.current

    setLoading(true)
    onChainAddressCurrent({
      variables: { input: { walletId } },
    })
      .then((result) => {
        if (!isCurrent()) return
        const addr = result.data?.onChainAddressCurrent?.address
        if (addr) setAddress(addr)
        else setFailed(true)
      })
      .catch((err) => {
        if (!isCurrent()) return
        // The QR shows the failure and offers New; no toast on top of it.
        setError(err?.message ?? "Unknown error")
        setFailed(true)
      })
      .finally(() => {
        if (isCurrent()) setLoading(false)
      })
  }, [walletId, onChainAddressCurrent])

  /** Resolves Created once a fresh address is on screen; the old one keeps working. */
  const generateNewAddress =
    useCallback(async (): Promise<NewOnchainAddressResultType> => {
      if (!walletId) return NewOnchainAddressResult.Failed
      generationRef.current += 1
      const generation = generationRef.current
      const isCurrent = () => generation === generationRef.current
      try {
        const result = await onChainAddressCreate({
          variables: { input: { walletId } },
        })
        if (!isCurrent()) return NewOnchainAddressResult.Superseded
        const payload = result.data?.onChainAddressCreate
        const codes = payload?.errors.map((err) => err.code) ?? []
        if (codes.includes(RATE_LIMITED_CODE)) return NewOnchainAddressResult.RateLimited
        const addr = payload?.address
        if (!addr) {
          reportError(
            "onChainAddressCreate",
            new Error(
              `onChainAddressCreate returned no address: ${JSON.stringify(codes)}`,
            ),
          )
          return NewOnchainAddressResult.Failed
        }
        setAddress(addr)
        setFailed(false)
        return NewOnchainAddressResult.Created
      } catch (err) {
        reportError("onChainAddressCreate", err)
        return isCurrent()
          ? NewOnchainAddressResult.Failed
          : NewOnchainAddressResult.Superseded
      } finally {
        // A create can only start once the fetch has settled, but if it overtook one,
        // that fetch can no longer clear `loading` itself.
        if (isCurrent()) setLoading(false)
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

  return { address, loading, error, failed, getFullUriFn, generateNewAddress }
}
