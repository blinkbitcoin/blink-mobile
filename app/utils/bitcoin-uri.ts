const SATS_PER_BTC = 1e8

export const satsToBtc = (sats: number): number => sats / SATS_PER_BTC

type BuildBitcoinUriParams = {
  address: string
  amountSats?: number
  memo?: string
  uppercase?: boolean
  prefix?: boolean
}

export const buildBitcoinUri = ({
  address,
  amountSats,
  memo,
  uppercase = false,
  prefix = true,
}: BuildBitcoinUriParams): string => {
  const addr = uppercase ? address.toUpperCase() : address
  const base = prefix ? `bitcoin:${addr}` : addr

  const params = new URLSearchParams()
  if (amountSats) params.append("amount", `${satsToBtc(amountSats)}`)
  if (memo) params.append("message", encodeURI(memo))

  const query = params.toString()
  return query ? `${base}?${query}` : base
}
