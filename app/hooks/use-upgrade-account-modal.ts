import { useEffect } from "react"
import { useApolloClient } from "@apollo/client"

import { AccountLevel } from "@app/graphql/generated"
import { getAccountMetadata, updateAccountMetadata } from "@app/graphql/client-only-query"

const BALANCE_TO_SHOW_TRIAL_LIMIT_MODAL = 125

export const useUpgradeModalTrigger = ({
  accountId,
  levelAccount,
  numericBalance,
  openUpgradeModal,
}: {
  accountId: string | undefined
  levelAccount: AccountLevel | undefined
  numericBalance: number
  openUpgradeModal: () => void
}) => {
  const client = useApolloClient()

  // Increment session count
  useEffect(() => {
    if (!accountId) return

    const metadata = getAccountMetadata(client, accountId)
    updateAccountMetadata(client, accountId, {
      sessionCount: metadata.sessionCount + 1,
    })
  }, [client, accountId])

  // Evaluate to show upgrade modal
  useEffect(() => {
    if (!accountId || levelAccount !== AccountLevel.Zero) return

    const { sessionCount, upgradeModalShown } = getAccountMetadata(client, accountId)

    const isFirstSession =
      sessionCount === 1 && numericBalance >= BALANCE_TO_SHOW_TRIAL_LIMIT_MODAL

    const isSecondSession = sessionCount === 2

    const shouldShowUpgradeModal =
      (isFirstSession || isSecondSession) && upgradeModalShown !== sessionCount

    if (shouldShowUpgradeModal) {
      openUpgradeModal()
      updateAccountMetadata(client, accountId, {
        upgradeModalShown: sessionCount,
      })
    }
  }, [client, accountId, levelAccount, numericBalance, openUpgradeModal])
}
