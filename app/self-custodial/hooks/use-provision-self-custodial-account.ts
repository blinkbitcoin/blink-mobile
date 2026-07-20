import { useCallback } from "react"
import Crypto from "react-native-quick-crypto"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { selfCustodialCreateWallet } from "@app/self-custodial/bridge"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"

export const useProvisionSelfCustodialAccount = () => {
  const { reloadSelfCustodialAccounts } = useAccountRegistry()
  const network = useSparkNetwork()

  /** beforeCreate runs with the new id in hand but before the wallet exists, so a caller
   *  can persist a record first and a crash mid-create leaves a harmless dangling record
   *  instead of an orphaned wallet. */
  const provision = useCallback(
    async (beforeCreate?: (accountId: string) => Promise<void>): Promise<string> => {
      const accountId = Crypto.randomUUID()
      if (beforeCreate) await beforeCreate(accountId)
      await selfCustodialCreateWallet(accountId, network)
      await reloadSelfCustodialAccounts()
      return accountId
    },
    [reloadSelfCustodialAccounts, network],
  )

  return { provision }
}
