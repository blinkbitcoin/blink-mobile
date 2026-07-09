import { gql } from "@apollo/client"

import { useMigrationSupportDetailsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import {
  useWalletIdentity,
  useWalletMnemonic,
} from "@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic"

gql`
  query migrationSupportDetails {
    me {
      id
      phone
      username
      email {
        address
      }
      defaultAccount {
        id
      }
    }
  }
`

type MigrationSupportDetails = {
  accountId: string
  pubKey: string
  username: string
  email: string
  phone: string
}

/**
 * Gathers the diagnostics the support team needs to resolve a failed migration: the
 * custodial account identity from the backend plus the provisioned self-custodial
 * wallet's identity pubkey derived on device.
 */
export const useMigrationSupportDetails = (): MigrationSupportDetails => {
  const isAuthed = useIsAuthed()
  const { data } = useMigrationSupportDetailsQuery({ skip: !isAuthed })
  const mnemonic = useWalletMnemonic()
  const pubKey = useWalletIdentity(mnemonic)

  return {
    accountId: data?.me?.defaultAccount?.id ?? "",
    pubKey,
    username: data?.me?.username ?? "",
    email: data?.me?.email?.address ?? "",
    phone: data?.me?.phone ?? "",
  }
}
