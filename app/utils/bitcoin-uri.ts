const SATS_PER_BTC = 1e8
const BIP21_AMOUNT_DECIMALS = 8

export const satsToBtc = (sats: number): number => sats / SATS_PER_BTC

const formatBip21Amount = (amountSats: number): string => {
  const fixed = satsToBtc(amountSats).toFixed(BIP21_AMOUNT_DECIMALS)
  return fixed.replace(/\.?0+$/, "")
}

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

  const parts: string[] = []
  if (amountSats) parts.push(`amount=${formatBip21Amount(amountSats)}`)
  if (memo) parts.push(`message=${encodeURIComponent(memo)}`)

  return parts.length ? `${base}?${parts.join("&")}` : base
}
