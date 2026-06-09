import { type TransactionFragment } from "@app/graphql/generated"

export type HighlightBaseline = {
  btc: number | null
  usd: number | null
}

export const resolveHighlightBaseline = ({
  fragments,
  baselineBtcId,
  baselineUsdId,
}: {
  fragments: ReadonlyArray<TransactionFragment>
  baselineBtcId: string | undefined
  baselineUsdId: string | undefined
}): HighlightBaseline => {
  const createdAtById = new Map(fragments.map((tx) => [tx.id, tx.createdAt]))
  const resolve = (id: string | undefined): number | null =>
    id ? createdAtById.get(id) ?? null : null

  return { btc: resolve(baselineBtcId), usd: resolve(baselineUsdId) }
}

export const shouldHighlightByTimestamp = ({
  createdAt,
  baselineCreatedAt,
  isLatestForCurrency,
}: {
  createdAt: number
  baselineCreatedAt: number | null
  isLatestForCurrency: boolean
}): boolean => {
  if (baselineCreatedAt === null) return isLatestForCurrency
  return createdAt > baselineCreatedAt
}
