import { useCallback } from "react"
import Crypto from "react-native-quick-crypto"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { selfCustodialCreateWallet } from "@app/self-custodial/bridge"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"

export const useProvisionSelfCustodialAccount = () => {
  const { reloadSelfCustodialAccounts } = useAccountRegistry()
  const network = useSparkNetwork()

  const provision = useCallback(async (): Promise<string> => {
    const accountId = Crypto.randomUUID()
    await selfCustodialCreateWallet(accountId, network)
    await reloadSelfCustodialAccounts()
    return accountId
  }, [reloadSelfCustodialAccounts, network])

  return { provision }
}
