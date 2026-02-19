import { useEffect, useMemo, useRef, useState } from "react"

import { useOnChainAddressCurrentMutation } from "@app/graphql/generated"

import { getPaymentRequestFullUri } from "../payment/helpers"
import { GetFullUriFn, Invoice } from "../payment/index.types"

type UseOnChainAddressOptions = {
  amount?: number
  memo?: string
}

export const useOnChainAddress = (
  walletId: string | undefined,
  { amount, memo }: UseOnChainAddressOptions = {},
) => {
  const [onChainAddressCurrent] = useOnChainAddressCurrentMutation()
  const mutationRef = useRef(onChainAddressCurrent)
  mutationRef.current = onChainAddressCurrent

  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(walletId))

  useEffect(() => {
    if (!walletId) return

    setLoading(true)
    mutationRef
      .current({
        variables: { input: { walletId } },
      })
      .then((result) => {
        const addr = result.data?.onChainAddressCurrent?.address
        if (addr) setAddress(addr)
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
      })
  }, [walletId])

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

  return { address, loading, getFullUriFn }
}
