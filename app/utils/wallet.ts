export const TYPE_BITCOIN = "bitcoin"
export const TYPE_LIGHTNING = "lightning"

const prefixByType = {
  [TYPE_BITCOIN]: "bitcoin:",
}

export const getFullUri = ({
  input,
  amount,
  memo,
  uppercase = false,
  prefix = true,
  type = TYPE_BITCOIN,
}: GetFullUriInput): string => {
  if (type === TYPE_LIGHTNING) {
    // TODO add lightning:
    return uppercase && input ? input.toUpperCase() : input
  }

  const uriPrefix = prefix ? prefixByType[type] : ""
  const uri = `${uriPrefix}${input}`
  const params = new URLSearchParams()

  if (amount) params.append("amount", `${satsToBTC(amount)}`)

  if (memo) {
    params.append("message", encodeURI(memo))
    return `${uri}?${params.toString()}`
  }

  return uri + (params.toString() ? "?" + params.toString() : "")
}

export const satsToBTC = (satsAmount: number): number => satsAmount / 10 ** 8
