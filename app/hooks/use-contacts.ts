import { useCustodialContactAdapter } from "@app/custodial/contact-adapter"
import { useSelfCustodialContactAdapter } from "@app/self-custodial/contact-adapter"
import { type ContactAdapter } from "@app/types/contact.types"
import { AccountType } from "@app/types/wallet.types"

import { useAccountRegistry } from "./use-account-registry"

export const useContacts = (): ContactAdapter & { loading: boolean } => {
  const { activeAccount } = useAccountRegistry()
  const custodial = useCustodialContactAdapter()
  const selfCustodial = useSelfCustodialContactAdapter()

  return activeAccount?.type === AccountType.SelfCustodial ? selfCustodial : custodial
}
