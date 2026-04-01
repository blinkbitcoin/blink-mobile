import { getBreezClient } from "../../client"

export const listPayments = async () => {
  const sdk = await getBreezClient()

  return sdk.listPayments({
    typeFilter: undefined,
    statusFilter: undefined,
    assetFilter: undefined,
    paymentDetailsFilter: undefined,
    fromTimestamp: undefined,
    toTimestamp: undefined,
    offset: undefined,
    limit: undefined,
    sortAscending: undefined,
  })
}
