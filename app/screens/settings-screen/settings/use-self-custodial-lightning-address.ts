import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"

/**
 * Resolves the active self-custodial account's lightning address, preferring the
 * live SDK value but falling back to the persisted one while the SDK reconnects,
 * so a user who already registered never sees the "create address" prompt.
 */
export const useSelfCustodialLightningAddress = (): string | null => {
  const { activeAccount, selfCustodialEntries } = useAccountRegistry()
  const { lightningAddress: liveLightningAddress } = useSelfCustodialWallet()

  const persistedLightningAddress =
    selfCustodialEntries.find((entry) => entry.id === activeAccount?.id)
      ?.lightningAddress ?? null

  return liveLightningAddress ?? persistedLightningAddress
}
