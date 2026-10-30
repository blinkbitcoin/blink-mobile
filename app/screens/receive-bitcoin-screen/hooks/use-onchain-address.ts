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

type WalletAddressState = {
  walletId: string | undefined
  address: string | null
  loading: boolean
  error: string | null
  // The fetch settled without an address: nothing more is coming until the user retries.
  failed: boolean
}

const initialState = (walletId: string | undefined): WalletAddressState => ({
  walletId,
  address: null,
  loading: Boolean(walletId),
  error: null,
  failed: false,
})

const isInitialState = (state: WalletAddressState, walletId: string | undefined) => {
  const initial = initialState(walletId)
  return (Object.keys(initial) as (keyof WalletAddressState)[]).every(
    (key) => state[key] === initial[key],
  )
}

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

  // Tagged with the wallet it belongs to, so the render that switches wallets already
  // reads as "no address": clearing it from an effect would leave that render, and the
  // QR, copy and share it feeds, holding the previous wallet's address.
  const [state, setState] = useState<WalletAddressState>(() => initialState(walletId))
  const current = state.walletId === walletId ? state : initialState(walletId)
  const { address, loading, error, failed } = current
  // Only the latest fetch or create may write; a late answer may belong to another wallet.
  const generationRef = useRef(0)

  useEffect(() => {
    generationRef.current += 1
    const generation = generationRef.current
    // Kept as is when already reset: a fresh object would re-render, and with no wallet
    // the effect can run again on every render.
    setState((prev) => (isInitialState(prev, walletId) ? prev : initialState(walletId)))
    if (!walletId) return
    const isCurrent = () => generation === generationRef.current
    const update = (patch: Partial<WalletAddressState>) =>
      setState((prev) => ({ ...prev, ...patch }))

    onChainAddressCurrent({
      variables: { input: { walletId } },
    })
      .then((result) => {
        if (!isCurrent()) return
        const addr = result.data?.onChainAddressCurrent?.address
        if (addr) update({ address: addr })
        else update({ failed: true })
      })
      .catch((err) => {
        if (!isCurrent()) return
        // The QR shows the failure and offers New; no toast on top of it.
        update({ error: err?.message ?? "Unknown error", failed: true })
      })
      .finally(() => {
        if (isCurrent()) update({ loading: false })
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
        setState((prev) => ({ ...prev, address: addr, failed: false }))
        return NewOnchainAddressResult.Created
      } catch (err) {
        reportError("onChainAddressCreate", err)
        return isCurrent()
          ? NewOnchainAddressResult.Failed
          : NewOnchainAddressResult.Superseded
      } finally {
        // A create can only start once the fetch has settled, but if it overtook one,
        // that fetch can no longer clear `loading` itself.
        if (isCurrent()) setState((prev) => ({ ...prev, loading: false }))
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
