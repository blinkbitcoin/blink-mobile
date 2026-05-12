import { useCustodialContactAdapter } from "@app/custodial/contact-adapter"
import { useSelfCustodialContacts } from "@app/self-custodial/hooks/use-self-custodial-contacts"
import { type ContactAdapter } from "@app/types/contact.types"
import { AccountType } from "@app/types/wallet.types"

import { useAccountRegistry } from "./use-account-registry"

export const useContacts = (): ContactAdapter & { loading: boolean } => {
  const { activeAccount } = useAccountRegistry()
  const custodial = useCustodialContactAdapter()
  const selfCustodial = useSelfCustodialContacts()

  return activeAccount?.type === AccountType.SelfCustodial ? selfCustodial : custodial
}
